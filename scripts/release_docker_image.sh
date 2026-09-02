#!/bin/bash

# Docker 镜像发布脚本
# 用于构建、推送和发布 Docker 镜像
# 基于 docker-release-bash-blueprint.md 技术蓝图实现

# 设置严格模式
set -euo pipefail

# 脚本目录和项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$SCRIPT_DIR/docker_release/config/build-config.yaml"
DEFAULT_ENV_FILE="$SCRIPT_DIR/docker_release/config/default.env"

# 全局变量
COMMAND=""
SERVICE=""
VERSION=""
ENVIRONMENT="production"
EDITION="ce"
REGISTRY_URL=""
REGISTRY_NAMESPACE=""
BUILD_PLATFORM=""
LOG_LEVEL=""
LOG_FILE=""

# 日志级别常量
LOG_LEVEL_DEBUG=0
LOG_LEVEL_INFO=1
LOG_LEVEL_WARN=2
LOG_LEVEL_ERROR=3

# 当前日志级别
CURRENT_LOG_LEVEL=${LOG_LEVEL_INFO}

# 日志函数
log_message() {
    local level=$1
    local level_num=$2
    shift 2
    local message="$*"
    
    if [ $level_num -ge $CURRENT_LOG_LEVEL ]; then
        local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
        echo "[$timestamp] [$level] $message" >&2
        
        # 写入日志文件（如果配置了）
        if [ -n "${LOG_FILE:-}" ]; then
            mkdir -p "$(dirname "$LOG_FILE")"
            echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
        fi
    fi
}

log_debug() { log_message "DEBUG" $LOG_LEVEL_DEBUG "$@"; }
log_info() { log_message "INFO" $LOG_LEVEL_INFO "$@"; }
log_warn() { log_message "WARN" $LOG_LEVEL_WARN "$@"; }
log_error() { log_message "ERROR" $LOG_LEVEL_ERROR "$@"; }

# 错误处理函数
handle_error() {
    local exit_code=$?
    local line_number=$1
    local command="$2"
    
    log_error "Command failed with exit code ${exit_code} at line ${line_number}: ${command}"
    
    case $exit_code in
        1)
            log_error "General error occurred"
            ;;
        2)
            log_error "Configuration error occurred"
            ;;
        3)
            log_error "Build error occurred"
            ;;
        4)
            log_error "Push error occurred"
            ;;
        5)
            log_error "Authentication error occurred"
            ;;
        127)
            log_error "Command not found"
            ;;
        130)
            log_error "Script interrupted by user"
            ;;
        *)
            log_error "Unknown error occurred"
            ;;
    esac
    
    cleanup
    exit $exit_code
}

# 设置错误陷阱
trap 'handle_error ${LINENO} "$BASH_COMMAND"' ERR

# 清理函数
cleanup() {
    log_info "Performing cleanup..."
    # 退出前的清理操作
}

# 检查必需的工具
check_dependencies() {
    local missing_deps=()
    
    if ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
    fi
    
    if ! command -v yq &> /dev/null; then
        missing_deps+=("yq")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        log_error "Please install the missing tools and try again."
        exit 2
    fi
}

# 加载环境变量
load_env_file() {
    local env_file=$1
    
    if [ -f "$env_file" ]; then
        log_debug "Loading environment variables from $env_file"
        # 只加载未设置的环境变量，避免覆盖已存在的变量
        while IFS='=' read -r key value; do
            # 跳过注释和空行
            [[ $key =~ ^[[:space:]]*# ]] && continue
            [[ -z $key ]] && continue
            
            # 如果环境变量未设置，则从文件中加载
            if [ -z "${!key:-}" ]; then
                export "$key=$value"
                log_debug "Set $key from $env_file"
            else
                log_debug "Keeping existing $key value"
            fi
        done < "$env_file"
    else
        log_debug "Environment file $env_file not found, skipping"
    fi
}

# 从 YAML 配置文件读取值
get_yaml_value() {
    local key=$1
    local default_value=${2:-""}
    
    if [ -f "$CONFIG_FILE" ]; then
        yq eval "$key" "$CONFIG_FILE" 2>/dev/null || echo "$default_value"
    else
        echo "$default_value"
    fi
}

# 加载配置
load_configuration() {
    log_info "Loading configuration..."
    
    # 加载项目根目录的环境变量
    load_env_file "$PROJECT_ROOT/.env"
    
    # 加载默认环境变量
    load_env_file "$DEFAULT_ENV_FILE"
    
    # 从环境变量或配置文件读取设置
    REGISTRY_URL=${REGISTRY_URL:-$(get_yaml_value ".registry.url" "ghcr.io")}
    REGISTRY_NAMESPACE=${REGISTRY_NAMESPACE:-$(get_yaml_value ".registry.namespace" "geluzhiwei1")}
    BUILD_PLATFORM=${BUILD_PLATFORM:-$(get_yaml_value ".build_options.platform" "linux/amd64")}
    LOG_LEVEL=${LOG_LEVEL:-$(get_yaml_value ".logging.level" "INFO")}
    LOG_FILE=${LOG_FILE:-$(get_yaml_value ".logging.file" "logs/docker-release.log")}
    
    # 设置日志级别
    case "$LOG_LEVEL" in
        DEBUG) CURRENT_LOG_LEVEL=$LOG_LEVEL_DEBUG ;;
        INFO)  CURRENT_LOG_LEVEL=$LOG_LEVEL_INFO ;;
        WARN)  CURRENT_LOG_LEVEL=$LOG_LEVEL_WARN ;;
        ERROR) CURRENT_LOG_LEVEL=$LOG_LEVEL_ERROR ;;
        *)     CURRENT_LOG_LEVEL=$LOG_LEVEL_INFO ;;
    esac
    
    log_debug "Registry URL: $REGISTRY_URL"
    log_debug "Registry Namespace: $REGISTRY_NAMESPACE"
    log_debug "Build Platform: $BUILD_PLATFORM"
    log_debug "Log Level: $LOG_LEVEL"
    log_debug "Log File: $LOG_FILE"
}

# 显示帮助信息
show_help() {
    cat << EOF
Docker 镜像发布脚本

用法: $0 <command> [options]

命令:
    build <service>              构建指定服务的 Docker 镜像
    push <service>               推送指定服务的 Docker 镜像
    build_and_push <service>     构建并推送指定服务的 Docker 镜像
    build_all                    构建所有配置的服务
    push_all                     推送所有配置的服务
    release                      构建并推送所有配置的服务（完整发布流程）
    list_services                列出所有支持的服务
    show_config                  显示当前配置信息

参数:
    --version <version>          镜像版本标签（必需）
    --environment <env>          构建环境（可选，默认为 production）
    --edition <ed>               三版分发:ce(默认) / ee / saas
                                 镜像名追加 -<edition> 后缀,tag 模板 {edition} 占位
    --help                       显示此帮助信息

示例:
    $0 build frontend --version 0.3.5 --edition ce
    $0 build backend --version 0.1.1 --environment staging --edition ee
    $0 build_and_push frontend --version 0.3.5 --edition saas
    $0 build_all --version 1.0.0 --edition ce
    $0 push_all --version 1.0.0 --environment staging --edition ee
    $0 release --version 1.0.0 --environment production --edition saas
    $0 list_services
    $0 show_config

注:
    CE 不需要任何私有仓库挂载;
    EE 需先在 yinghuo-openlabel-ee 私有仓运行 CE_ROOT=<本仓路径> scripts/setup-edition.sh ee;
    SaaS 需先在 yinghuo-openlabel-saas 私有仓运行
        CE_ROOT=<本仓路径> YH_EDITION_EE_REPO=<ee 仓> scripts/setup-edition.sh saas
      (自动挂 EE + SaaS)。
    脚本会在构建前校验挂载点,声明了 ee/saas 但目录缺失会 fail-fast。

EOF
}

# 解析命令行参数
parse_arguments() {
    if [ $# -eq 0 ]; then
        show_help
        exit 1
    fi
    
    COMMAND=$1
    shift
    
    # 处理不需要参数的命令
    case "$COMMAND" in
        list_services|show_config|--help|-h)
            if [ $# -ne 0 ]; then
                log_error "Command '$COMMAND' does not accept any arguments"
                exit 2
            fi
            return
            ;;
    esac
    
    # 解析参数
    while [ $# -gt 0 ]; do
        case $1 in
            --version)
                VERSION="$2"
                shift 2
                ;;
            --environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            --edition)
                EDITION="$2"
                shift 2
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                # 对于需要服务名的命令，第一个非选项参数是服务名
                if [[ "$COMMAND" =~ ^(build|push|build_and_push)$ ]] && [ -z "$SERVICE" ]; then
                    SERVICE="$1"
                    shift
                else
                    log_error "Unknown argument: $1"
                    exit 2
                fi
                ;;
        esac
    done

    # 校验 edition 取值
    case "$EDITION" in
        ce|ee|saas) ;;
        *)
            log_error "Invalid --edition '$EDITION' (must be ce|ee|saas)"
            exit 2
            ;;
    esac
    
    # 验证必需的参数
    case "$COMMAND" in
        build|push|build_and_push)
            if [ -z "$SERVICE" ]; then
                log_error "Service name is required for command '$COMMAND'"
                exit 2
            fi
            if [ -z "$VERSION" ]; then
                log_error "Version is required for command '$COMMAND'"
                exit 2
            fi
            ;;
        build_all|push_all|release)
            if [ -z "$VERSION" ]; then
                log_error "Version is required for command '$COMMAND'"
                exit 2
            fi
            ;;
    esac
}

# 校验 edition 挂载点与声明一致
# CE:  ee/saas 都不挂
# EE:  ee 挂、saas 不挂
# SaaS: ee + saas 都挂
validate_edition_mounts() {
    local edition=$1
    local require_list=$(yq eval ".edition_mounts.$edition.require[]" "$CONFIG_FILE" 2>/dev/null || true)
    local forbid_list=$(yq eval ".edition_mounts.$edition.forbid[]" "$CONFIG_FILE" 2>/dev/null || true)
    local failed=0

    log_info "Validating mount points for edition '$edition'..."

    if [ -n "$require_list" ]; then
        while IFS= read -r p; do
            [[ -z "$p" || "$p" = "null" ]] && continue
            if [[ ! -e "$PROJECT_ROOT/$p" ]]; then
                log_error "Required mount missing for edition '$edition': $p"
                log_error "  Run from yinghuo-openlabel-$edition private repo:"
                log_error "    CE_ROOT=$PROJECT_ROOT scripts/setup-edition.sh $edition"
                failed=1
            fi
        done <<< "$require_list"
    fi

    if [ -n "$forbid_list" ]; then
        while IFS= read -r p; do
            [[ -z "$p" || "$p" = "null" ]] && continue
            if [[ -e "$PROJECT_ROOT/$p" || -L "$PROJECT_ROOT/$p" ]]; then
                log_error "Forbidden mount present for edition '$edition': $p"
                log_error "  Run from yinghuo-openlabel-$edition private repo:"
                log_error "    CE_ROOT=$PROJECT_ROOT scripts/setup-edition.sh $edition  # 会 teardown"
                failed=1
            fi
        done <<< "$forbid_list"
    fi

    if [ "$failed" -ne 0 ]; then
        exit 2
    fi
    log_info "Edition mount validation passed for '$edition'"
}

# 生成镜像标签
generate_tags() {
    local service=$1
    local version=$2
    local environment=$3
    local edition=$4
    local tags=()

    # 获取服务配置
    local service_config=$(get_yaml_value ".services.$service")

    if [ "$service_config" = "null" ]; then
        log_error "Service '$service' not found in configuration"
        exit 2
    fi

    # 获取基础标签模板
    local base_tags=$(yq eval ".services.$service.tags[]" "$CONFIG_FILE" 2>/dev/null || true)

    # 获取环境特定标签
    local env_tags=$(yq eval ".environments.$environment.tags[]" "$CONFIG_FILE" 2>/dev/null || true)

    # 处理基础标签
    if [ -n "$base_tags" ]; then
        while IFS= read -r tag_template; do
            if [ -n "$tag_template" ] && [ "$tag_template" != "null" ]; then
                # 替换模板变量
                local tag=$(echo "$tag_template" | sed \
                    -e "s/{version}/$version/g" \
                    -e "s/{environment}/$environment/g" \
                    -e "s/{edition}/$edition/g")
                tags+=("$tag")
            fi
        done <<< "$base_tags"
    fi

    # 处理环境特定标签
    if [ -n "$env_tags" ]; then
        while IFS= read -r tag_template; do
            if [ -n "$tag_template" ] && [ "$tag_template" != "null" ]; then
                # 替换模板变量
                local tag=$(echo "$tag_template" | sed \
                    -e "s/{version}/$version/g" \
                    -e "s/{environment}/$environment/g" \
                    -e "s/{edition}/$edition/g")
                tags+=("$tag")
            fi
        done <<< "$env_tags"
    fi

    # 去重并返回
    printf '%s\n' "${tags[@]}" | sort -u
}

# 构建服务镜像
build_service() {
    local service=$1
    local version=$2
    local environment=$3
    local edition=$4

    log_info "Building $service image with version $version for environment $environment (edition=$edition)"

    # 校验挂载点(EE/SaaS 必须先在私有仓运行 setup-edition.sh,见 show_help)
    validate_edition_mounts "$edition"

    # 获取服务配置
    local base_image_name=$(get_yaml_value ".services.$service.image_name")
    local dockerfile=$(get_yaml_value ".services.$service.dockerfile")
    local context=$(get_yaml_value ".services.$service.context")

    if [ "$base_image_name" = "null" ] || [ "$dockerfile" = "null" ] || [ "$context" = "null" ]; then
        log_error "Invalid configuration for service '$service'"
        exit 2
    fi

    # 追加 edition 后缀:yinghuo-frontend → yinghuo-frontend-ce
    local image_name="${base_image_name}-${edition}"

    # 检查 Dockerfile 是否存在
    if [ ! -f "$PROJECT_ROOT/$dockerfile" ]; then
        log_error "Dockerfile not found: $PROJECT_ROOT/$dockerfile"
        exit 3
    fi

    # 生成标签
    local tags=($(generate_tags "$service" "$version" "$environment" "$edition"))

    if [ ${#tags[@]} -eq 0 ]; then
        log_error "No tags generated for service '$service'"
        exit 2
    fi

    # 构建标签参数
    local tag_args=()
    for tag in "${tags[@]}"; do
        tag_args+=("-t" "$REGISTRY_URL/$REGISTRY_NAMESPACE/$image_name:$tag")
    done

    # 获取构建参数
    local build_args=()

    # 添加服务特定的构建参数
    local node_version=$(yq eval ".services.$service.build_args.NODE_VERSION" "$CONFIG_FILE" 2>/dev/null || true)
    if [ -n "$node_version" ] && [ "$node_version" != "null" ]; then
        build_args+=("--build-arg" "NODE_VERSION=$node_version")
    fi

    local pnpm_version=$(yq eval ".services.$service.build_args.PNPM_VERSION" "$CONFIG_FILE" 2>/dev/null || true)
    if [ -n "$pnpm_version" ] && [ "$pnpm_version" != "null" ]; then
        build_args+=("--build-arg" "PNPM_VERSION=$pnpm_version")
    fi

    # 添加环境特定的构建参数
    local build_env=$(yq eval ".environments.$environment.build_args.BUILD_ENVIRONMENT" "$CONFIG_FILE" 2>/dev/null || true)
    if [ -n "$build_env" ] && [ "$build_env" != "null" ]; then
        build_args+=("--build-arg" "BUILD_ENVIRONMENT=$build_env")
    fi

    local debug=$(yq eval ".environments.$environment.build_args.DEBUG" "$CONFIG_FILE" 2>/dev/null || true)
    if [ -n "$debug" ] && [ "$debug" != "null" ]; then
        build_args+=("--build-arg" "DEBUG=$debug")
    fi

    # 添加通用构建参数
    build_args+=("--build-arg" "APP_VERSION=$version")
    build_args+=("--build-arg" "BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%S")")
    build_args+=("--build-arg" "YH_EDITION=$edition")

    # 构建命令
    local build_cmd=(
        docker buildx build --load
        "--platform" "$BUILD_PLATFORM"
        "${build_args[@]}"
        "${tag_args[@]}"
        "-f" "$PROJECT_ROOT/$dockerfile"
        "$PROJECT_ROOT/$context"
    )

    log_debug "Build command: ${build_cmd[*]}"

    # 执行构建
    if "${build_cmd[@]}"; then
        log_info "Successfully built $service image (image=$image_name)"
        return 0
    else
        log_error "Failed to build $service image"
        exit 3
    fi
}

# 推送服务镜像
push_service() {
    local service=$1
    local version=$2
    local environment=$3
    local edition=$4

    log_info "Pushing $service image with version $version for environment $environment (edition=$edition)"

    # 获取服务配置
    local base_image_name=$(get_yaml_value ".services.$service.image_name")

    if [ "$base_image_name" = "null" ]; then
        log_error "Invalid configuration for service '$service'"
        exit 2
    fi

    # 追加 edition 后缀,与 build_service 保持一致
    local image_name="${base_image_name}-${edition}"

    # 生成标签
    local tags=($(generate_tags "$service" "$version" "$environment" "$edition"))

    if [ ${#tags[@]} -eq 0 ]; then
        log_error "No tags generated for service '$service'"
        exit 2
    fi

    # 登录到容器仓库
    log_info "Logging in to container registry..."

    # 检查 GITHUB_TOKEN 是否设置
    if [ -z "${GITHUB_TOKEN:-}" ]; then
        log_error "GITHUB_TOKEN environment variable is not set or empty"
        log_error "Please set GITHUB_TOKEN with a valid GitHub Personal Access Token"
        log_error "You can create a token at: https://github.com/settings/tokens"
        log_error "The token needs 'write:packages' scope for pushing to GitHub Container Registry"
        log_error "Example: export GITHUB_TOKEN=your_token_here"
        exit 5
    fi

    if echo "$GITHUB_TOKEN" | docker login "$REGISTRY_URL" --username "$REGISTRY_NAMESPACE" --password-stdin; then
        log_debug "Successfully logged in to $REGISTRY_URL"
    else
        log_error "Failed to log in to $REGISTRY_URL"
        log_error "Please check your GITHUB_TOKEN and registry permissions"
        exit 5
    fi

    # 推送所有标签
    for tag in "${tags[@]}"; do
        local full_image_name="$REGISTRY_URL/$REGISTRY_NAMESPACE/$image_name:$tag"
        log_info "Pushing $full_image_name"

        if docker push "$full_image_name"; then
            log_info "Successfully pushed $full_image_name"
        else
            log_error "Failed to push $full_image_name"
            exit 4
        fi
    done

    log_info "Successfully pushed all tags for $service"
}

# 构建并推送服务镜像
build_and_push_service() {
    local service=$1
    local version=$2
    local environment=$3
    local edition=$4

    build_service "$service" "$version" "$environment" "$edition"
    push_service "$service" "$version" "$environment" "$edition"
}

# 构建所有服务
build_all_services() {
    local version=$1
    local environment=$2
    local edition=$3

    log_info "Building all services with version $version for environment $environment (edition=$edition)"

    # 校验挂载点(只校验一次,所有服务共用)
    validate_edition_mounts "$edition"

    # 获取所有服务
    local services=$(yq eval '.services | keys | .[]' "$CONFIG_FILE" 2>/dev/null || true)

    if [ -z "$services" ]; then
        log_error "No services found in configuration"
        exit 2
    fi

    # 检查是否启用并行构建
    local parallel=$(get_yaml_value ".build_options.parallel" "true")

    if [ "$parallel" = "true" ]; then
        log_info "Building services in parallel..."
        local pids=()

        while IFS= read -r service; do
            if [ -n "$service" ] && [ "$service" != "null" ]; then
                build_service "$service" "$version" "$environment" "$edition" &
                pids+=($!)
            fi
        done <<< "$services"

        # 等待所有构建完成
        for pid in "${pids[@]}"; do
            if ! wait $pid; then
                log_error "One or more builds failed"
                exit 3
            fi
        done

        log_info "All services built successfully"
    else
        log_info "Building services sequentially..."

        while IFS= read -r service; do
            if [ -n "$service" ] && [ "$service" != "null" ]; then
                build_service "$service" "$version" "$environment" "$edition"
            fi
        done <<< "$services"

        log_info "All services built successfully"
    fi
}

# 推送所有服务
push_all_services() {
    local version=$1
    local environment=$2
    local edition=$3

    log_info "Pushing all services with version $version for environment $environment (edition=$edition)"

    # 获取所有服务
    local services=$(yq eval '.services | keys | .[]' "$CONFIG_FILE" 2>/dev/null || true)

    if [ -z "$services" ]; then
        log_error "No services found in configuration"
        exit 2
    fi

    # 登录到容器仓库（只需要登录一次）
    log_info "Logging in to container registry..."

    # 检查 GITHUB_TOKEN 是否设置
    if [ -z "${GITHUB_TOKEN:-}" ]; then
        log_error "GITHUB_TOKEN environment variable is not set or empty"
        log_error "Please set GITHUB_TOKEN with a valid GitHub Personal Access Token"
        log_error "You can create a token at: https://github.com/settings/tokens"
        log_error "The token needs 'write:packages' scope for pushing to GitHub Container Registry"
        log_error "Example: export GITHUB_TOKEN=your_token_here"
        exit 5
    fi

    if echo "$GITHUB_TOKEN" | docker login "$REGISTRY_URL" --username "$REGISTRY_NAMESPACE" --password-stdin; then
        log_debug "Successfully logged in to $REGISTRY_URL"
    else
        log_error "Failed to log in to $REGISTRY_URL"
        log_error "Please check your GITHUB_TOKEN and registry permissions"
        exit 5
    fi

    # 推送所有服务
    while IFS= read -r service; do
        if [ -n "$service" ] && [ "$service" != "null" ]; then
            push_service "$service" "$version" "$environment" "$edition"
        fi
    done <<< "$services"

    log_info "All services pushed successfully"
}

# 完整发布流程
release_all() {
    local version=$1
    local environment=$2
    local edition=$3

    log_info "Starting full release process with version $version for environment $environment (edition=$edition)"

    # 构建所有服务
    build_all_services "$version" "$environment" "$edition"

    # 推送所有服务
    push_all_services "$version" "$environment" "$edition"

    log_info "Full release process completed successfully"
}

# 列出所有服务
list_services() {
    log_info "Available services:"
    
    # 获取所有服务
    local services=$(yq eval '.services | keys | .[]' "$CONFIG_FILE" 2>/dev/null || true)
    
    if [ -z "$services" ]; then
        log_error "No services found in configuration"
        exit 2
    fi
    
    while IFS= read -r service; do
        if [ -n "$service" ] && [ "$service" != "null" ]; then
            local image_name=$(get_yaml_value ".services.$service.image_name")
            local dockerfile=$(get_yaml_value ".services.$service.dockerfile")
            echo "  - $service (image: $image_name, dockerfile: $dockerfile)"
        fi
    done <<< "$services"
}

# 显示配置信息
show_configuration() {
    log_info "Current configuration:"
    echo "  Registry URL: $REGISTRY_URL"
    echo "  Registry Namespace: $REGISTRY_NAMESPACE"
    echo "  Build Platform: $BUILD_PLATFORM"
    echo "  Log Level: $LOG_LEVEL"
    echo "  Log File: $LOG_FILE"
    echo "  Configuration File: $CONFIG_FILE"
    echo "  Default Environment File: $DEFAULT_ENV_FILE"
    
    # 显示服务信息
    echo ""
    log_info "Configured services:"
    local services=$(yq eval '.services | keys | .[]' "$CONFIG_FILE" 2>/dev/null || true)
    
    while IFS= read -r service; do
        if [ -n "$service" ] && [ "$service" != "null" ]; then
            local image_name=$(get_yaml_value ".services.$service.image_name")
            echo "  - $service: $image_name"
        fi
    done <<< "$services"
    
    # 显示环境信息
    echo ""
    log_info "Configured environments:"
    local environments=$(yq eval '.environments | keys | .[]' "$CONFIG_FILE" 2>/dev/null || true)
    
    while IFS= read -r environment; do
        if [ -n "$environment" ] && [ "$environment" != "null" ]; then
            echo "  - $environment"
        fi
    done <<< "$environments"
}

# 主函数
main() {
    # 先检查是否是帮助命令，避免加载配置
    if [ $# -gt 0 ] && { [ "$1" = "--help" ] || [ "$1" = "-h" ]; }; then
        show_help
        exit 0
    fi
    
    # 检查依赖
    check_dependencies
    
    # 解析命令行参数
    parse_arguments "$@"
    
    # 加载配置
    load_configuration
    
    # 执行命令
    case $COMMAND in
        build)
            build_service "$SERVICE" "$VERSION" "$ENVIRONMENT" "$EDITION"
            ;;
        push)
            push_service "$SERVICE" "$VERSION" "$ENVIRONMENT" "$EDITION"
            ;;
        build_and_push)
            build_and_push_service "$SERVICE" "$VERSION" "$ENVIRONMENT" "$EDITION"
            ;;
        build_all)
            build_all_services "$VERSION" "$ENVIRONMENT" "$EDITION"
            ;;
        push_all)
            push_all_services "$VERSION" "$ENVIRONMENT" "$EDITION"
            ;;
        release)
            release_all "$VERSION" "$ENVIRONMENT" "$EDITION"
            ;;
        list_services)
            list_services
            ;;
        show_config)
            show_configuration
            ;;
        --help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            show_help
            exit 2
            ;;
    esac
}

# 执行主函数
main "$@"
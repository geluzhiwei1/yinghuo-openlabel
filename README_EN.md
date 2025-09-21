
[README_EN](README_EN.md) | [README中文](README.md)

[github](https://github.com/geluzhiwei1/yinghuo-openlabel) | [gitee](https://gitee.com/gerwee/yinghuo) | [官网](https://www.geluzhiwei.com/) 

# Yinghuo-OpenLabel: A Professional Data Annotation Platform

Yinghuo-OpenLabel is a professional, open-source data annotation platform designed for autonomous driving, robotics, and computer vision. It provides a complete toolchain for processing and annotating complex sensor data, including 2D images, videos, and 3D point clouds. The platform supports AI-assisted annotation features to enhance efficiency and strictly adheres to the **OpenLABEL** international standard, ensuring data interoperability and standardization.

## Core Features

*   **Multi-modal Data Annotation**:
    *   A powerful set of tools for fine-grained annotation of images, videos, and 3D point cloud data.
    *   Supports multiple annotation types, such as 2D bounding boxes, semantic segmentation, and 3D cuboids.
*   **AI Assistance and Automation**:
    *   Integrates a deep learning model (DNN) module that supports semi-automatic or fully automatic annotation using models in formats like ONNX.
*   **Data and Project Management**:
    *   Provides functions for importing and exporting data packages.
    *   Supports systematic management of annotation tasks, label batches, and datasets.
*   **Standardization and Specification**:
    *   Deeply integrates and follows the `OpenLABEL` specification, defining a clear data format and taxonomy.
*   **System Management**:
    *   Includes complete user, role, and team management functions, supporting multi-tenancy and access control.

## Core Features and Development Roadmap
Features completed, under development, and planned for the future.
### 📚 Annotation Tools
- Visual 2D Annotation
    * [√] 2D Bounding Box
    * [√] 2D Rotated Bounding Box
    * [√] Semantic Segmentation - Polygon
    * [√] Semantic Segmentation - Mask
    * [√] Video - Event Annotation
    * [-] Model Assistance - ONNX Runtime Web
        * [-] Model Loading
        * [-] Model Inference
    * [] Model Assistance - Backend Service
- Point Cloud 3D Annotation
    * [ ] 3D Bounding Box
    * [ ] 3D Rotated Bounding Box
    * [ ] Semantic Segmentation - Polygon
    * [ ] Semantic Segmentation - Mask
- Multi-modal Annotation
    * [ ] Point Cloud-Image: Project 3D point cloud annotations to 2D images
    * [ ] Image-Text
    * [ ] Video-Text
- 4D Annotation

### 🔧 Management Features

- Data Management
    * [√] Data Package Import/Export
    * [ ] Annotation Data Review and Validation
- User Management
    * [√] User Login
    * [ ] User and Team Management
    * [ ] Permission Control
- Project Management
    * [√] Annotation Task Management

## Tech Stack

The project uses a front-end/back-end separated architecture.

*   **Frontend (`apps/web-app`)**:
    *   **Core Framework**: Vue 3
    *   **Language**: TypeScript
    *   **Build Tool**: Vite
    *   **UI Library**: Element Plus
    *   **State Management**: Pinia
    *   **3D Rendering**: Three.js
    *   **Data Loading**: @loaders.gl (for PCD, LAS, etc.)

*   **Backend (`services/web-api`)**:
    *   **Core Framework**: FastAPI
    *   **Language**: Python 3.10+
    *   **Database**: PostgreSQL + FerretDB (MongoDB compatible), Redis
    *   **ORM**: Tortoise ORM, Motor
    *   **Data Processing**: NumPy, Pandas, Open3D, OpenCV

## Quick Start Guide

This guide will help you set up the development environment for Yinghuo-OpenLabel.

### 1. Start Base Services

The project relies on `PostgreSQL`, `FerretDB`, and `Redis`. Use the provided Docker Compose file to start them.

```bash
docker-compose -f docker/docker-compose-dev.yaml up -d
```

### 2. Run the Backend Service

The backend is managed by `pdm`.

```bash
# Navigate to the backend directory
cd services/web-api

# Install dependencies
pdm install

# Start the development server
pdm run dev
```

### 3. Run the Frontend Service

The frontend is managed by `pnpm`.

```bash
# Navigate to the frontend directory
cd apps/web-app

# Install dependencies
pnpm install

# Start the development server
pnpm run dev
```

After completing these steps, the frontend application should be available at `http://localhost:5173` and the backend API at `http://localhost:8000`.

## Project Structure Overview

*   `apps/web-app/`: Contains the Vue.js frontend application.
*   `services/web-api/`: Contains the FastAPI backend application.
*   `docker/`: Includes Docker configurations for development and production.
*   `docs/`: Project documentation.
*   `openlabel-specs/`: Contains OpenLABEL standard specification files.

## Contribution Guide

We welcome contributions from the community! (Details to be added)

## License

This project is licensed under the AGPL-3.0 License. See the [LICENSE](LICENSE) file for details.
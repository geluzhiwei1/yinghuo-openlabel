// PLY loader — 走 rust_wasm 的 pc_parse_ply。
//
// 接口形态参照 YhPCDLoader.js:parse() 返回 {header, position, normal, color,
// intensity, label, rgb} 这种纯结构,由 gl-pcs.ts 后续组装 BufferGeometry。
// 与 PCD 不同,PLY 没有 JS fallback — 必须等 wasm 加载完成。
// 如果 wasm 不可用,抛错给上层(loadPcd 的 onError 回调)。

import { FileLoader, Loader } from 'three';
import { getRustHelper } from '@/pointcloud/utils/rust-helper';

class PLYLoader extends Loader {

	constructor( manager ) {
		super( manager );
	}

	load( url, onLoad, onProgress, onError ) {
		const scope = this;
		const loader = new FileLoader( scope.manager );
		loader.setPath( scope.path );
		loader.setResponseType( 'arraybuffer' );
		loader.setRequestHeader( scope.requestHeader );
		loader.setWithCredentials( scope.withCredentials );
		loader.load( url, function ( data ) {
			try {
				onLoad( scope.parse( data ) );
			} catch ( e ) {
				if ( onError ) onError( e );
				else console.error( e );
				scope.manager.itemError( url );
			}
		}, onProgress, onError );
	}

	parse( data ) {
		const helper = getRustHelper();
		if ( ! helper?.pc_parse_ply ) {
			throw new Error( 'PLY 解析需要 rust_wasm,请确认 /webapps/rust_wasm/ 已部署且 loadRustWasm() 已调用' );
		}

		const out = helper.pc_parse_ply( new Uint8Array( data ) );
		if ( ! out ) {
			throw new Error( 'pc_parse_ply 返回 null,检查 PLY 文件完整性' );
		}

		// 把 typed array 转 JS array,保持与 YhPCDLoader 同样的返回形状
		const position = Array.from( out.position );
		const color = out.color ? Array.from( out.color ) : [];
		const normal = out.normal ? Array.from( out.normal ) : [];
		const intensity = out.intensity ? Array.from( out.intensity ) : [];
		const label = out.label ? Array.from( out.label ) : [];

		return {
			header: out.header,
			position,
			normal,
			color,
			intensity,
			label,
			rgb: color,
		};
	}

}

export { PLYLoader };

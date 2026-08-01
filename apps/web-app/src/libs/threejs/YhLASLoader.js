// LAS / LAZ loader — 走 rust_wasm 的 pc_parse_las / pc_parse_laz。
//
// rust 侧启用 las crate 的 laz feature,LAZ 文件透明解压。.las 和 .laz 走同一个
// las::Reader 入口,所以 JS 这边只是按后缀调不同的 wasm 函数(实现上是别名)。
//
// 接口形态参照 YhPCDLoader.js,parse() 返回 {header, position, color, intensity,
// normal, label, rgb} 纯结构,normal/label 在 LAS 标准里不存在,恒为空数组。

import { FileLoader, Loader } from 'three';
import { getRustHelper } from '@/pointcloud/utils/rust-helper';

class LASLoader extends Loader {

	// 'las' | 'laz' — 决定调哪个 wasm 函数(实现上等价,但语义清晰)
	constructor( manager, format = 'las' ) {
		super( manager );
		this.format = format;
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
		const fn = this.format === 'laz' ? helper?.pc_parse_laz : helper?.pc_parse_las;
		if ( ! fn ) {
			throw new Error(
				`${ this.format.toUpperCase() } 解析需要 rust_wasm,请确认 /webapps/rust_wasm/ 已部署且 loadRustWasm() 已调用`
			);
		}

		const out = fn( new Uint8Array( data ) );
		if ( ! out ) {
			throw new Error( `pc_parse_${ this.format } 返回 null,检查 ${ this.format.toUpperCase() } 文件完整性` );
		}

		const position = Array.from( out.position );
		const color = out.color ? Array.from( out.color ) : [];
		const intensity = out.intensity ? Array.from( out.intensity ) : [];

		return {
			header: out.header,
			position,
			normal: [],   // LAS 不带法线
			color,
			intensity,
			label: [],    // LAS classification 暂不映射到 label,需要时再扩
			rgb: color,
		};
	}

}

export { LASLoader };

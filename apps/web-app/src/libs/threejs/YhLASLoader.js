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
				`${ this.format.toUpperCase() } 解析需要 rust_wasm 的 pc_parse_${ this.format },请确认 /webapps/rust_wasm/ 已部署最新版本`
			);
		}

		const out = fn( new Uint8Array( data ) );
		if ( ! out ) {
			throw new Error( `pc_parse_${ this.format } 返回 null,检查 ${ this.format.toUpperCase() } 文件完整性` );
		}

		const position = Array.from( out.position );
		const color = out.color ? Array.from( out.color ) : [];
		const intensity = out.intensity ? Array.from( out.intensity ) : [];

		// LAS/LAZ 常是地理参考坐标(UTM 等,坐标值数十万米),相机 far=10000、
		// 取景围绕原点,不平移的话整朵云在视锥外,画布空白。
		// 包围盒中心离原点超过 1km 时平移到原点,偏移量记进 header 供追溯。
		const header = { ...out.header };
		if ( position.length >= 3 ) {
			const mn = [ Infinity, Infinity, Infinity ];
			const mx = [ -Infinity, -Infinity, -Infinity ];
			for ( let i = 0; i < position.length; i ++ ) {
				const c = i % 3;
				if ( position[ i ] < mn[ c ] ) mn[ c ] = position[ i ];
				if ( position[ i ] > mx[ c ] ) mx[ c ] = position[ i ];
			}
			const center = [ ( mn[ 0 ] + mx[ 0 ] ) / 2, ( mn[ 1 ] + mx[ 1 ] ) / 2, ( mn[ 2 ] + mx[ 2 ] ) / 2 ];
			if ( Math.hypot( center[ 0 ], center[ 1 ], center[ 2 ] ) > 1000 ) {
				for ( let i = 0; i < position.length; i += 3 ) {
					position[ i ] -= center[ 0 ];
					position[ i + 1 ] -= center[ 1 ];
					position[ i + 2 ] -= center[ 2 ];
				}
				header.center_offset = center;
			}
		}

		// wasm 按 16bit(/65535)归一化颜色,但很多工具把 8bit 值直接存进 16bit
		// 字段,得到 ~0.001 的近黑色。最大分量不超过 255/65535 时按 8bit 修正。
		if ( color.length > 0 ) {
			let cMax = 0;
			for ( let i = 0; i < color.length; i ++ ) {
				if ( color[ i ] > cMax ) cMax = color[ i ];
			}
			if ( cMax > 0 && cMax <= 255 / 65535 + 1e-6 ) {
				const k = 65535 / 255;
				for ( let i = 0; i < color.length; i ++ ) {
					color[ i ] *= k;
				}
			}
		}

		return {
			header,
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

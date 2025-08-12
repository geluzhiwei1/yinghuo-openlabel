/**
 * Point Format 7
 * https://laspy.readthedocs.io/en/latest/intro.html
 */
export interface LASFormat7 {
  /**
   * signed 32
   */
  x?: number[]
  y?: number[]
  z?: number[]

  /**
   * unsigned 16
   */
  intensity?: number[]
  /**
   * unsigned 8
   */
  classification?: number[]
  user_data?: number[]
  /**
   * Floating 64
   */
  gps_time?: number[]
  /**
   * unsigned 8
   */
  point_source_id?: number[]

  /**
   * unsigned 16
   */
  red?: number[]
  green?: number[]
  blue?: number[]

  /**
   * signed 16
   */
  scan_angle?: number[]
}

/**
 * PCD Format
 * https://pointclouds.org/documentation/tutorials/pcd_file_format.html
 */
export interface PCDFormat {
  //
  x?: number[]
  y?: number[]
  z?: number[]
  //
  position: number[]

  rgb?: number[]
  intensity?: number[]
  label?: number[]

  // normals
  normal_x?: number[]
  normal_y?: number[]
  normal_z?: number[]
}

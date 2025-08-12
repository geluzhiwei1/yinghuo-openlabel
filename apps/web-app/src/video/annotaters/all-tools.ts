import { BBoxBuilder } from './bboxBuilder'
import { RBBoxBuilder } from './rbboxBuilder'
import { PolylineBuilder } from './polylineBuilder'
import { PolylinePencil } from './polylinePencil'
import { MaskBrush } from './maskBrush'
import { PolygonEditor } from './polygonEditor'
import { TextPromptBBoxTool } from './textPromptBBoxTool'
import { PolylineAnnotater } from './polylineAnnotater'
import { PolygonBuilder } from './polygonBuilder'
import { BBoxAnnotater } from './bboxAnnotater'
import { AutoLabelTool } from './autoLabelTool'
import { GeometryBuilderFromPoints } from './geometryBuilderFromPoints'
import { PromptSegment } from './promptSegment'
import { VideoPromptSegment } from './videoPromptSegment'

const AnnoRegistry = new Map<string, any>()
AnnoRegistry.set(RBBoxBuilder.name, {ToolClass: RBBoxBuilder})
AnnoRegistry.set(BBoxBuilder.name, {ToolClass: BBoxBuilder})
AnnoRegistry.set(PolylineBuilder.name, {ToolClass: PolylineBuilder})
AnnoRegistry.set(PolygonBuilder.name, {ToolClass: PolygonBuilder})
AnnoRegistry.set(PolylinePencil.name, {ToolClass: PolylinePencil})
AnnoRegistry.set(MaskBrush.name, {ToolClass: MaskBrush})
AnnoRegistry.set(PolygonEditor.name, {ToolClass: PolygonEditor})
AnnoRegistry.set(PolylineAnnotater.name, {ToolClass: PolylineAnnotater})
AnnoRegistry.set(BBoxAnnotater.name, {ToolClass: BBoxAnnotater})
AnnoRegistry.set(TextPromptBBoxTool.name, {ToolClass: TextPromptBBoxTool})
AnnoRegistry.set(AutoLabelTool.name, {ToolClass: AutoLabelTool })
AnnoRegistry.set(GeometryBuilderFromPoints.name, {ToolClass: GeometryBuilderFromPoints})
AnnoRegistry.set(PromptSegment.name, {ToolClass: PromptSegment})
AnnoRegistry.set(VideoPromptSegment.name, {ToolClass: VideoPromptSegment})

export {AnnoRegistry}
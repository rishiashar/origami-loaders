import { defineOrigamiLoader } from './element';
import { defineOrigamiLesson } from './lesson';

export { OrigamiLoader, defineOrigamiLoader, type Look, type StepInfo } from './element';
export { OrigamiLesson, defineOrigamiLesson, lessonSteps, type LessonStep } from './lesson';
export {
  registerModel, getModel, listModels,
  buildCrane, buildPlane, buildPleat, buildEnvelope, buildBoat, buildFrog, buildSwan, buildHeart, buildWhale, buildFox,
  type ModelBuilder,
} from './models/index';
export { Folder, StepBuilder, LAYER, type Folded, type Face, type FaceInfo, type Filter, type Joint, type Step, type StepMeta } from './fold';
export { Player, type Frame } from './player';
export { eases, defaultPose, type EaseName, type Pose } from './motion';
export { SvgScene, paintOrder, defaultCamera, type Camera } from './scene';
export { paperTexture } from './texture';
// Geometry the models are written with, for writing your own.
export { side, intersect, type P2 } from './geom';
export { apply, rotation, type Mat, type Vec3 } from './math';
export { v3, sub, dot, cross, unit, turn, angleAbout, track } from './models/kinematics';

defineOrigamiLoader();
defineOrigamiLesson();

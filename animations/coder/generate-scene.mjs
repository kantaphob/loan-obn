// Rebuild with: node animations/coder/generate-scene.mjs
// Vector parts remain separate so the .riv contains a real articulated rig.
import { writeFileSync } from 'node:fs'
const fill = color => `<Fill><SolidColor colorValue="FF${color}"/></Fill>`
const ellipse = (name,x,y,w,h,color,attrs='') => `<Shape name="${name}" x="${x}" y="${y}" ${attrs}><Ellipse width="${w}" height="${h}"/>${fill(color)}</Shape>`
const rect = (name,x,y,w,h,color,r=0,attrs='') => `<Shape name="${name}" x="${x}" y="${y}" ${attrs}><Rectangle width="${w}" height="${h}" cornerRadiusTL="${r}"/>${fill(color)}</Shape>`
const poly = (name,points,color,attrs='') => `<Shape name="${name}" ${attrs}><PointsPath isClosed="true">${points.map(([x,y])=>`<StraightVertex x="${x}" y="${y}"/>`).join('')}</PointsPath>${fill(color)}</Shape>`
const node = (name,id,x,y,contents,attrs='') => `<Node name="${name}" id="0:${id}" x="${x}" y="${y}" ${attrs}>${contents}</Node>`
const stars = node('Success sparks',110,0,-180,[[-50,-18],[45,-40],[58,18]].map(([x,y],i)=>`<Shape x="${x}" y="${y}" rotation="${i*.4}"><Star width="${15-i*2}" height="${15-i*2}" points="4" innerRadius="0.25"/>${fill('F2D47B')}</Shape>`).join(''),'opacity="0"')
const error = node('Error cloud',111,0,-230,ellipse('Smoke one',0,0,35,17,'A5A4B2')+ellipse('Smoke two',-14,-8,21,20,'C8C2CD')+ellipse('Smoke three',12,-11,23,22,'D7CDCC'),'opacity="0"')
const thought = node('Thinking cloud',112,42,-211,ellipse('Bubble',0,0,45,30,'E5DDD2')+ellipse('Tail',-17,22,7,7,'E5DDD2')+ellipse('Dot A',-10,0,3,3,'756284')+ellipse('Dot B',0,0,3,3,'756284')+ellipse('Dot C',10,0,3,3,'756284'),'opacity="0"')
const tea = node('Tea cup',109,0,29,rect('Rim',0,-6,17,3,'D9B678',2)+rect('Cup',0,0,14,12,'99BFB1',3)+ellipse('Handle',10,0,8,8,'D9B678'),'opacity="0"')
const scroll = node('Handoff scroll',108,0,29,rect('Paper',0,0,25,31,'F0DBAA',2)+rect('Band',0,0,26,5,'976C52')+rect('Top rod',0,-17,33,4,'C6A264',2)+rect('Bottom rod',0,17,33,4,'C6A264',2),'opacity="0"')
const arm = (id,x,side) => node(side+' arm',id,x,-131,scroll+ (side==='Left' ? '' : tea) +ellipse(side+' hand',0,36,13,17,'EEC4AC')+poly(side+' sleeve',[[-10,-4],[11,-4],[15,29],[0,39],[-14,29]],side==='Left'?'70608F':'514F7C')+rect(side+' cuff',0,28,24,5,'C4AC75',2))
// Foreground first is the Rive draw order.
const head = node('Head',101,0,-181,
  poly('Forelock',[[-23,-18],[-2,-30],[21,-18],[23,3],[10,-7],[2,-17],[-7,-2],[-10,-13],[-26,7]],'242735')+
  node('Eyes',106,0,1,ellipse('Right iris',10,0,7,9,'5F4B6A')+ellipse('Left iris',-10,0,7,9,'5F4B6A')+ellipse('Right catchlight',11,-2,2,3,'FFF4DB')+ellipse('Left catchlight',-9,-2,2,3,'FFF4DB')+rect('Right lash',10,-5,10,2,'252937',1)+rect('Left lash',-10,-5,10,2,'252937',1))+
  rect('Mouth',0,15,7,1.8,'A46B71',1)+ellipse('Right blush',18,10,8,3,'DB9E99')+ellipse('Left blush',-18,10,8,3,'DB9E99')+
  ellipse('Face',0,2,53,61,'F1CBB3')+ellipse('Ears',0,4,65,16,'D9A58F')+
  rect('Hairpin',4,-34,65,3,'D8BA76',1)+ellipse('Hair bun',2,-39,27,25,'272A39')+rect('Bun band',1,-32,28,4,'D0AD6D',1)+ellipse('Back head',0,-4,62,69,'252836'))
const torso = node('Torso',113,0,-100,
  rect('Belt stone',0,8,12,12,'D1BA85',3)+rect('Belt',0,8,53,9,'363C52',2)+
  poly('Ivory lapel',[[-21,-45],[0,-29],[21,-45],[7,-12],[0,-8],[-9,-14]],'DDD4CC')+
  poly('Gold lapel',[[19,-42],[23,-38],[-4,-7],[-8,-10]],'B89B6B')+
  poly('Purple robe',[[-23,-43],[23,-43],[30,-15],[37,65],[12,72],[0,61],[-13,72],[-38,64],[-29,-12]],'625681')+
  poly('Inner robe',[[-14,-20],[13,-20],[22,66],[1,64],[-23,66]],'3B425C'))
const leg = (id,x,side) => node(side+' leg',id,x,-39,rect(side+' boot',3,37,21,15,'252B3C',5)+rect(side+' trouser',0,15,13,40,'42465D',5))
const hair = node('Trailing hair',107,0,-176,poly('Long hair',[[-26,-16],[25,-16],[28,50],[48,105],[22,90],[17,112],[-7,98],[-30,106],[-23,80],[-37,90],[-30,48]],'282D40')+poly('Ribbon',[[-10,-25],[-2,-23],[-16,80],[-28,100],[-23,78]],'9584AB'))
const body = node('Character root',100,120,292,stars+error+thought+head+arm(105,30,'Right')+torso+arm(104,-30,'Left')+leg(102,-13,'Left')+leg(103,13,'Right')+hair)
// Only the left arm owns the scroll node. Remove its duplicate from the right.
const uniqueBody=body.replace(/(<Node name="Right arm"[^>]*>)<Node name="Handoff scroll"[\s\S]*?<\/Node>/,'$1')
const ids={root:100,head:101,leftLeg:102,rightLeg:103,leftArm:104,rightArm:105,eyes:106,hair:107,scroll:108,tea:109,stars:110,smoke:111,thought:112,torso:113}
const base={root:{14:292,15:0},head:{15:0},leftLeg:{15:0},rightLeg:{15:0},leftArm:{15:.08},rightArm:{15:-.08},eyes:{17:1},hair:{15:0},scroll:{18:0},tea:{18:0},stars:{18:0,15:0},smoke:{18:0,14:-230},thought:{18:0},torso:{17:1}}
const curves={
 Idle:{root:{14:[[0,292],[60,290],[120,292]]},rightArm:{15:[[0,-.45],[60,-.52],[120,-.45]]},tea:{18:1},eyes:{17:[[0,1],[96,1],[99,.05],[104,1],[120,1]]}},
 Thinking:{head:{15:[[0,-.08],[60,.06],[120,-.08]]},leftArm:{15:-1.9},thought:{18:1},root:{14:[[0,292],[60,289],[120,292]]}},
 Walk:{leftLeg:{15:[[0,-.5],[15,.5],[30,-.5]]},rightLeg:{15:[[0,.5],[15,-.5],[30,.5]]},leftArm:{15:[[0,.3],[15,-.4],[30,.3]]},rightArm:{15:[[0,-.4],[15,.3],[30,-.4]]},root:{14:[[0,292],[7,287],[15,292],[22,287],[30,292]]},hair:{15:[[0,-.04],[15,.06],[30,-.04]]}},
 Working:{root:{14:309},torso:{17:.78},leftLeg:{15:-1.1},rightLeg:{15:-.85},head:{15:.12},leftArm:{15:[[0,-1.05],[8,-.83],[16,-1.05]]},rightArm:{15:[[0,.82],[8,1.05],[16,.82]]}},
 ToolCalling:{head:{15:-.1},rightArm:{15:[[0,-1.8],[30,-1.5],[60,-1.8]]},thought:{18:1}},
 Handoff:{leftArm:{15:-1.15},scroll:{18:1},rightArm:{15:.1},root:{14:[[0,292],[30,289],[60,292]]}},
 Success:{root:{14:[[0,292],[12,263],[24,292],[36,275],[48,292],[90,292]]},leftArm:{15:2.3},rightArm:{15:-2.3},stars:{18:[[0,0],[12,1],[65,1],[90,0]],15:[[0,-.1],[90,.25]]}},
 Error:{root:{15:[[0,0],[6,-.08],[12,.08],[18,-.06],[24,0],[120,0]]},leftArm:{15:2},rightArm:{15:-2},smoke:{18:1,14:[[0,-230],[120,-245]]}},
}
let animations='',states=''
Object.entries(curves).forEach(([name,overrides],i)=>{
 const duration=name==='Walk'?30:name==='Working'?16:name==='Success'?90:name==='ToolCalling'||name==='Handoff'?60:120
 const values=structuredClone(base)
 for(const [target,props] of Object.entries(overrides)) Object.assign(values[target],props)
 let keys=''
 for(const [target,props] of Object.entries(values)) keys+=`<KeyedObject objectId="0:${ids[target]}">${Object.entries(props).map(([property,v])=>`<KeyedProperty propertyKey="${property}">${(Array.isArray(v)?v:[[0,v]]).map(([frame,value])=>`<KeyFrameDouble frame="${frame}" value="${value}" interpolationType="linear"/>`).join('')}</KeyedProperty>`).join('')}</KeyedObject>`
 animations+=`<LinearAnimation name="${name}" id="0:${200+i}" duration="${duration}" loopValue="${name==='Success'?'oneShot':'loop'}">${keys}</LinearAnimation>`
 states+=`<AnimationState id="0:${220+i}" animationId="0:${200+i}" reset="true" x="${160+(i%4)*200}" y="${Math.floor(i/4)*200}">${Object.keys(curves).map((_,j)=>j===i?'':`<StateTransition stateToId="0:${220+j}" duration="130"><TransitionViewModelCondition opValue="equal"><TransitionPropertyViewModelComparator><BindablePropertyNumber><DataBindContext sourcePathIds="0:40-0:45" propertyKey="636"/></BindablePropertyNumber></TransitionPropertyViewModelComparator><TransitionValueNumberComparator value="${j}"/></TransitionViewModelCondition></StateTransition>`).join('')}</AnimationState>`
})
const rml=`<Rive version="1" kind="fragment"><Artboard name="Coder" id="0:2" width="240" height="340" styleId="0:5" viewModelId="0:40" viewModelInstanceId="0:41" defaultStateMachineId="0:7"><LayoutComponentStyle id="0:5" name="Artboard Style"/>${uniqueBody}<StateMachine name="CoderController" id="0:7"><StateMachineLayer name="Pose" id="0:8"><EntryState x="-100" y="0"><StateTransition stateToId="0:220"/></EntryState><AnyState x="-100" y="-150"/><ExitState x="-100" y="150"/>${states}</StateMachineLayer></StateMachine>${animations}</Artboard><ViewModel name="CoderState" id="0:40" defaultInstanceId="0:41"><ViewModelPropertyNumber name="pose" id="0:45"/><ViewModelInstance name="Default" id="0:41" exports="true"><ViewModelInstanceNumber viewModelPropertyId="0:45" propertyValue="0"/></ViewModelInstance></ViewModel></Rive>`
writeFileSync(new URL('scene.rml',import.meta.url),rml)

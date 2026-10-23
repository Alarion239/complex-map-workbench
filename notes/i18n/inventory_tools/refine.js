// second pass: candidates = visible + review minus code-ish rules; writes cand.json
const fs=require('fs');const [,,inp,out]=process.argv;const R=JSON.parse(fs.readFileSync(inp));
const CODEP=new Set(['class','style','cacheKey','slot','arcKey','heightMode','id','type','kind','key','role','mode','group_','for','name_','lineKey','sig','ck','vk','href','data-k','data-i','data-mode','data-side','data-id','data-act','data-n','data-v','data-key','data-zp','inputmode','autocomplete','spellcheck','aria-hidden','aria-haspopup','aria-controls','enterkeyhint','tabindex','pattern','step','min','max','value_','d','fill','stroke']);
const DEBUG_FN=new Set(['pathOf','guardFrame','morphSelectGen','keep','lsk','smViewKey','smFor','winKey','mapKeyOf','invPlan','invPrep','smContent','syncGlobeTools','drawRulers','medianAbs','render3D','fontOf','prestart','keyOf','tmpEntry','preProgram','packShapes','finishLink','finishInv','invSources','invProgram','invAltProgram','passData','formsSrc','prepare','planChain','stepOps','polyOps','ratOps','customOps','rationalForm','pFin','pMul','ratGo','imageBox','rec','frame','setFloor','buildInverse','natPlan','stepPlan','invOpFns','emit','tv','g','lv_','FETCH','REGION_VS','LINE_VS','PROBE_VS','INV_HEAD','mapPoint']);
const all=[...R.visible,...R.review];const keep=[],drop=[];
for(const x of all){const v=x.value,c=x.ctx;let why=null;
 if(v==='use strict')why='directive';
 else if(/^--[\w-]/.test(v)||/^\s*\d{3}\s+\d+px|\d+px\s/.test(v)||/^(italic|bold|normal)\s/.test(v)&&/\$\{font|px/.test(v))why='css';
 else if(c.prop&&CODEP.has(c.prop))why='codeprop';
 else if(/^[\w${}().\-+*]*([|:,>][\w${}().\-+*x|:,>]*)+$/.test(v)&&!/\s/.test(v)&&!/^(Re|Im|arg)/.test(v)&&!/\\/.test(v))why='key';
 else if(DEBUG_FN.has(c.fn)&&x.file!=='parse.js'&&x.file!=='funcs.js'||DEBUG_FN.has(c.fn)&&x.file==='funcs.js'&&false)why='debug-fn';
 else if(x.file==='app.js'&&x.line>=4095&&x.line<=4190)why='morph-log';
 else if(x.file==='inverse.js'&&!/Error/.test(c.callee||''))why='inverse-diag';
 else if(x.file==='inverse.js')why='inverse-diag';
 else if(x.file==='gl.js'&&!['friendly','noGL'].includes(c.fn))why='gl-internal';
 else if(x.file==='glsl.js'&&!(c.callee==='Error'&&/^(lv|g)$/.test(c.fn)&&/Combine/.test(v)))why='glsl-internal';
 else if(/^(GLChain|Curves:|Inverse\.|REGION_PRE_FS|unknown program)/.test(v))why='internal-error';
 else if((c.callee==='Error'||c.callee==='RangeError')&&/^(nonfinite|var|pow|not rational|not finite|division by zero|not a polynomial)/.test(v))why='internal-error';
 if(why){x.why=why;drop.push(x)}else keep.push(x)}
fs.writeFileSync(out,JSON.stringify({keep,drop}));console.log('keep',keep.length,'drop',drop.length);
const by={};keep.forEach(x=>by[x.file]=(by[x.file]||0)+1);console.log(by);

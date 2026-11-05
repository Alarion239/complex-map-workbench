const {chromium}=require('playwright');const fs=require('fs');
const P=JSON.parse(fs.readFileSync('probe_src.json','utf8'));
const t=0.5;const pts=[];for(const re of [-0.5,0.3,0.9,1.3,1.8,2.3])for(const im of [13,16,19,22,25,27])pts.push([re,im]);
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--headless=new','--ignore-gpu-blocklist','--enable-gpu','--no-sandbox','--enable-features=Vulkan','--use-vulkan=native','--disable-vulkan-surface','--use-angle=vulkan']});
const p=await b.newPage();p.on('pageerror',e=>console.log('PAGEERR',e.message.slice(0,200)));
await p.goto('http://localhost:8123/test.html?ns=z'+Date.now()+'&lang=en&view=steps');
await p.waitForFunction('typeof CX!=="undefined"',null,{timeout:120000});
await p.evaluate('window.PS='+JSON.stringify(P)+';window.PTS='+JSON.stringify(pts)+';window.T='+t);
const r=await p.evaluate(`(()=>{
 const c=document.createElement('canvas');c.width=64;c.height=1;const gl=c.getContext('webgl2');if(!gl)return 'nogl';
 if(!gl.getExtension('EXT_color_buffer_float'))return 'noext';
 const main='\\nvec2 chainHom(int i, vec2 z, float t) { return (1.0 - t) * z + t * cx_zeta(z); }\\nuniform vec2 uW[64];out vec4 o;void main(){int i=int(gl_FragCoord.x);vec2 w=uW[i];ix0_roots(w,uInv[0].x);float m=0.0;for(int k=0;k<7;k++)if(ix0_k[k])m+=exp2(float(k));vec2 r=ix0_r[2];vec2 h=chainHom(0,r,uInv[0].x);o=vec4(m,r.x,r.y,length(h-w));}';
 const src='#version 300 es\\nprecision highp float;precision highp int;\\n'+PS.LIB+PS.g+PS.z+PS.lib+main;
 const vs='#version 300 es\\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.0-1.0,0.0,1.0);}';
 const mk=(ty,s)=>{const x=gl.createShader(ty);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(x).slice(0,600));return x};
 const pr=gl.createProgram();gl.attachShader(pr,mk(gl.VERTEX_SHADER,vs));gl.attachShader(pr,mk(gl.FRAGMENT_SHADER,src));gl.linkProgram(pr);if(!gl.getProgramParameter(pr,gl.LINK_STATUS))return 'link '+gl.getProgramInfoLog(pr);
 gl.useProgram(pr);
 const W=new Float32Array(128);PTS.forEach((q,i)=>{W[2*i]=q[0];W[2*i+1]=q[1]});gl.uniform2fv(gl.getUniformLocation(pr,'uW'),W);
 gl.uniform4fv(gl.getUniformLocation(pr,'uInv'),new Float32Array([T,1,0.5,0]));
 const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,64,1,0,gl.RGBA,gl.FLOAT,null);
 const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
 gl.viewport(0,0,64,1);gl.drawArrays(gl.TRIANGLES,0,3);const out=new Float32Array(64*4);gl.readPixels(0,0,64,1,gl.RGBA,gl.FLOAT,out);
 return Array.from(out);})()`);
if(typeof r==='string'){console.log(r);await b.close();return}
fs.writeFileSync('probe_out.json',JSON.stringify({pts,out:r}));console.log('ok');await b.close()})();

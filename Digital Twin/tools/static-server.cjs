const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=process.cwd();
const TYPES={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png'};
http.createServer((req,res)=>{
  const p=path.join(ROOT,decodeURIComponent(req.url.split('?')[0]));
  if(!p.startsWith(ROOT)){res.writeHead(403);return res.end('no');}
  fs.stat(p,(e,st)=>{
    if(e||!st.isFile()){res.writeHead(404);return res.end('404');}
    res.writeHead(200,{'Content-Type':TYPES[path.extname(p)]||'application/octet-stream','Access-Control-Allow-Origin':'*','Cache-Control':'no-store'});
    fs.createReadStream(p).pipe(res);
  });
}).listen(8799,'127.0.0.1',()=>console.log('static server on http://127.0.0.1:8799'));

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const types = {html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',json:'application/json',bin:'application/octet-stream'};
createServer(async(req,res)=>{
  const path = new URL(req.url,'http://localhost').pathname;
  const allowed = {'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/sky.js':'sky.js','/sealed.json':'sealed.json','/voice.bin':'voice.bin'};
  if(!allowed[path]){res.writeHead(404);res.end('Not found');return;}
  try { const file=allowed[path]; const data=await readFile(new URL('../dist/'+file,import.meta.url));res.writeHead(200,{'Content-Type':types[file.split('.').pop()],'Cache-Control':'no-store'});res.end(data); }
  catch{res.writeHead(500);res.end('Unable to load file');}
}).listen(4173,'127.0.0.1',()=>console.log('http://127.0.0.1:4173'));

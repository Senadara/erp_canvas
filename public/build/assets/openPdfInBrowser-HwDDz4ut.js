import{r as o}from"./app-C25N_A1M.js";function c({title:a,titleId:e,...t},n){return o.createElement("svg",Object.assign({xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",strokeWidth:1.5,stroke:"currentColor","aria-hidden":"true","data-slot":"icon",ref:n,"aria-labelledby":e},t),a?o.createElement("title",{id:e},a):null,o.createElement("path",{strokeLinecap:"round",strokeLinejoin:"round",d:"M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Zm3.75 11.625a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"}))}const b=o.forwardRef(c);function d(a){try{const e=new URL(a,window.location.href);return`${e.pathname}${e.search}${e.hash}`}catch{return a}}function p(a){const e=new URL(d(a),window.location.href);return e.searchParams.set("browser_pdf","1"),`${e.pathname}${e.search}`}function h(a){const e=window.atob(a),t=new Uint8Array(e.length);for(let n=0;n<e.length;n+=1)t[n]=e.charCodeAt(n);return new Blob([t],{type:"application/pdf"})}function l(a,e){a&&(a.opener=null,a.document.write(`
        <!doctype html>
        <html>
            <head>
                <title>Membuka PDF</title>
                <style>
                    body {
                        margin: 0;
                        min-height: 100vh;
                        display: grid;
                        place-items: center;
                        background: #f8fafc;
                        color: #0f172a;
                        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                    }
                    div {
                        max-width: 520px;
                        border: 1px solid #e2e8f0;
                        border-radius: 8px;
                        background: #fff;
                        padding: 20px 24px;
                        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
                        line-height: 1.6;
                    }
                    strong { display: block; margin-bottom: 6px; }
                </style>
            </head>
            <body><div>${e}</div></body>
        </html>
    `),a.document.close())}async function u(a){const e=window.open("","_blank");l(e,"Membuka PDF di browser...");try{const t=await fetch(p(a),{credentials:"include",headers:{Accept:"application/json","X-Requested-With":"XMLHttpRequest"}});if(!t.ok)throw new Error(`PDF request failed with status ${t.status}`);const n=t.headers.get("content-type")||"";let i;if(n.includes("application/json")){const r=await t.json();if(!r?.base64)throw new Error("PDF JSON payload is missing base64 content");i=h(r.base64)}else if(n.includes("application/pdf"))i=await t.blob();else throw new Error(`Unexpected PDF response type: ${n||"unknown"}`);const s=URL.createObjectURL(i);if(e)e.location.href=s;else{const r=document.createElement("a");r.href=s,r.target="_blank",r.rel="noopener noreferrer",document.body.appendChild(r),r.click(),r.remove()}window.setTimeout(()=>URL.revokeObjectURL(s),6e4)}catch(t){console.error(t),l(e,"<strong>PDF gagal dibuka.</strong> Pastikan sesi login masih aktif, lalu refresh halaman aplikasi dan coba lagi. Jika masih gagal, kirim pesan error di Console browser agar bisa dilacak."),window.alert("PDF gagal dibuka dari browser. Refresh halaman aplikasi lalu ulangi.")}}export{b as F,u as o};

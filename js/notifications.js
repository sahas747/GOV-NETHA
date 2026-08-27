import { auth, db } from "./firebase-config.js";
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, updateDoc, doc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

export async function notifyUser(userId,type,title,message,data={}){
  if(!userId) return;
  return addDoc(collection(db,"notifications"),{userId,type,title,message,data,read:false,createdAt:serverTimestamp()});
}
export function listenMyNotifications(uid,cb){
  if(!uid) return ()=>{};
  const q=query(collection(db,"notifications"),where("userId","==",uid));
  return onSnapshot(q,snap=>cb(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).slice(0,50)));
}
export async function markNotificationRead(id){ return updateDoc(doc(db,"notifications",id),{read:true}); }
export function showNotifications(notifications,container){
  if(!container) return;
  const unread=notifications.filter(n=>!n.read).length;
  const badge=document.getElementById("notificationBadge"); if(badge){badge.textContent=unread;badge.hidden=!unread;}
  container.innerHTML=notifications.length?notifications.map(n=>`<div class="notification-item ${n.read?"":"unread"}" data-notification-id="${n.id}">
    <b>${n.title||"Notification"}</b><p>${n.message||""}</p>
  </div>`).join(""):`<div class="card">තවම notifications නැහැ.</div>`;
  container.querySelectorAll("[data-notification-id]").forEach(el=>el.addEventListener("click",()=>markNotificationRead(el.dataset.notificationId)));
}

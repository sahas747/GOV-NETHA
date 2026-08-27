import { auth, db } from "./firebase-config.js";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc, getDoc, updateDoc, deleteDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const ADMIN_EMAIL = "slfilepodda1@gmail.com";
const isAdmin = () => (auth.currentUser?.email || "").toLowerCase() === ADMIN_EMAIL;

function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function threadIdFor(uid){ return `user_${uid}`; }

export async function sendAdminMessage(text, imageUrl=""){
  const u=auth.currentUser; if(!u) throw new Error("Login වෙන්න ඕන");
  const tid=threadIdFor(u.uid);
  await setDoc(doc(db,"chatThreads",tid),{
    userId:u.uid,userName:u.displayName||u.email||u.phoneNumber||"User",
    userEmail:u.email||"",userPhone:u.phoneNumber||"",updatedAt:serverTimestamp(),lastMessage:imageUrl?"📷 Photo":text
  },{merge:true});
  return addDoc(collection(db,"chatThreads",tid,"messages"),{
    senderId:u.uid,senderName:u.displayName||u.email||u.phoneNumber||"User",
    text:text||"",imageUrl:imageUrl||"",createdAt:serverTimestamp()
  });
}
export function listenAdminChat(uid,cb){
  const tid=threadIdFor(uid);
  return onSnapshot(query(collection(db,"chatThreads",tid,"messages"),orderBy("createdAt","asc")),snap=>cb(snap.docs.map(d=>({id:d.id,...d.data()}))));
}
export async function updateChatMessage(uid, messageId, text, imageUrl=null){
  const u=auth.currentUser; if(!u) throw new Error("Login වෙන්න ඕන");
  const tid=threadIdFor(uid);
  const ref=doc(db,"chatThreads",tid,"messages",messageId);
  const patch={text:text||""};
  if(imageUrl!==null) patch.imageUrl=imageUrl||"";
  await updateDoc(ref,patch);
}
export async function deleteChatMessage(uid,messageId){
  if(!isAdmin() && auth.currentUser?.uid!==uid) throw new Error("Not allowed");
  return deleteDoc(doc(db,"chatThreads",threadIdFor(uid),"messages",messageId));
}
export async function deleteAllChatMessages(uid){
  if(!isAdmin() && auth.currentUser?.uid!==uid) throw new Error("Not allowed");
  const snap=await getDocs(collection(db,"chatThreads",threadIdFor(uid),"messages"));
  await Promise.all(snap.docs.map(d=>deleteDoc(d.ref)));
}
export async function sendAdminReply(uid,text,imageUrl=""){
  if(!isAdmin()) throw new Error("Admin only");
  await setDoc(doc(db,"chatThreads",threadIdFor(uid)),{updatedAt:serverTimestamp(),lastMessage:imageUrl?"📷 Photo":text},{merge:true});
  return addDoc(collection(db,"chatThreads",threadIdFor(uid),"messages"),{
    senderId:auth.currentUser.uid,senderName:"Admin",text:text||"",imageUrl:imageUrl||"",createdAt:serverTimestamp()
  });
}
export function listenChatThreads(cb){
  if(!isAdmin()) return ()=>{};
  return onSnapshot(query(collection(db,"chatThreads"),orderBy("updatedAt","desc")),snap=>cb(snap.docs.map(d=>({id:d.id,...d.data()}))));
}
export function renderChatMessages(el,messages){
  if(!el) return;
  el.innerHTML=messages.map(m=>`<div class="chat-msg ${m.senderId===auth.currentUser?.uid?"mine":"theirs"}">
    <div class="chat-bubble"><b>${esc(m.senderName||"User")}</b><div>${esc(m.text||"")}</div>${m.imageUrl?`<div class="chat-photo-wrap"><img src="${m.imageUrl}" class="chat-image chat-image-large" alt="Chat photo"><div class="chat-photo-actions"><button type="button" class="btn light chat-edit-photo" data-mid="${m.id}">✏️ Edit</button><button type="button" class="btn danger chat-delete-photo" data-mid="${m.id}">🗑️ Delete</button></div></div>`:""}<div class="chat-msg-actions"><button type="button" class="btn light chat-edit" data-mid="${m.id}">✏️ Edit</button><button type="button" class="btn danger chat-delete" data-mid="${m.id}">🗑️ Delete</button></div></div>
  </div>`).join("");
  el.scrollTop=el.scrollHeight;
}

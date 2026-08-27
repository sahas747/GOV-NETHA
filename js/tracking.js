import { auth, db } from "./firebase-config.js";
import { collection, doc, setDoc, updateDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

let watchId=null;
export async function saveTodayWork(data){
  const u=auth.currentUser;if(!u)throw new Error("Login වෙන්න ඕන");
  const id=data.id||`${u.uid}_${data.gigId||"today"}`;
  return setDoc(doc(db,"todayWorks",id),{
    ...data,ownerId:u.uid,ownerName:u.displayName||u.email||u.phoneNumber||"User",
    updatedAt:serverTimestamp(),active:data.active!==false
  },{merge:true});
}
export async function stopTodayWork(id){
  return updateDoc(doc(db,"todayWorks",id),{active:false,updatedAt:serverTimestamp()});
}
export function listenTodayWorksForOwner(uid,cb){
  return onSnapshot(collection(db,"todayWorks"),s=>cb(s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.ownerId===uid)));
}
export function listenTodayWorkForBooking(gigId,ownerId,cb){
  return onSnapshot(collection(db,"todayWorks"),s=>cb(s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.gigId===gigId&&x.ownerId===ownerId&&x.active===true)));
}
export function startLiveLocation(updateFn,errorFn){
  if(!navigator.geolocation) throw new Error("මේ device එකේ location support නැහැ.");
  if(watchId!=null) navigator.geolocation.clearWatch(watchId);
  watchId=navigator.geolocation.watchPosition(
    pos=>updateFn(pos.coords.latitude,pos.coords.longitude,pos.coords.accuracy||0),
    err=>{
      console.warn("Live location error:",err);
      if(errorFn) errorFn(err);
    },
    {enableHighAccuracy:true,maximumAge:5000,timeout:15000}
  );
  return ()=>{if(watchId!=null){navigator.geolocation.clearWatch(watchId);watchId=null;}};
}
export function stopLiveLocation(){if(watchId!=null){navigator.geolocation.clearWatch(watchId);watchId=null;}}

# ගොවි නෙත LK — Final non-AI build

මෙම build එකේ **AI / Govi Helper / Telegram AI / Firebase Functions backend** intentionally ඉවත් කර ඇත.
AI feature එක පසුව වෙනම phase එකක් ලෙස නැවත integrate කළ හැක.

## දැනට තිබෙන ප්‍රධාන features
- Google / Phone OTP login
- Farmer / service-provider roles
- Service gig posting + admin approval
- Photo upload through Cloudinary
- Sri Lanka map + location based service search
- Booking requests and owner orders
- Admin dashboard + database tables + CSV export
- Homepage statistics/content management
- Rotating advertisements
- Weather + 7-day forecast
- Responsive mobile/desktop UI

## Hosting
මෙය GitHub Pages හෝ Firebase Hosting වැනි static hosting එකකට publish කළ හැක.

`firebase.json` මෙම release එකේ Hosting පමණක් භාවිතා කරන ලෙස සකසා ඇත.

## AI
AI source files මෙම release එකේ නැත. පසුව AI phase එක ආරම්භ කරන විට frontend chat UI, secure backend සහ Telegram integration වෙනම add කරන්න.


## Final UI update — August 2026
- Homepage service finder now separates **සීසෑම**, **අස්වනු නෙලීම**, and **අමතර සේවා** with direct sub-service links.
- Extra services include **නවාතැන් පහසුකම්, ආහාර පාන, ඉංධන වෙළදාම, අමතර කොටස් (ටැක්ටර් / හාවේස්ටර්), මැකෑනික් සේවා**.
- Homepage weather now supports browser live location plus district/area/village search.
- Admin can change the **Gig Listing Fee** from Admin Dashboard → Gig දැන්වීමේ ගාස්තුව. The new amount is stored at `settings/site.listingFee` and shown live on the Post a Gig form.
- Static JavaScript syntax checks and internal HTML asset-link checks passed on the final package.

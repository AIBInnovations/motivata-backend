import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "..", "..", ".env") });

const MONGODB_URL = process.argv[2] || process.env.MONGODB_URL || process.env.MONGODB_URI;
const APPLY = process.env.APPLY === "yes";

import SOSProgram from "../../src/Quiz/schemas/sosProgram.schema.js";
import SOSArticle from "../../src/Quiz/schemas/sosArticle.schema.js";

const words = (text) => String(text).trim().split(/\s+/).length;

const SIMPLE_ARTICLE = {
  dayNumber: 1,
  title: "Self Awareness & Clarity",
  body: "Self awareness brings clarity in thoughts and actions. The moment you are clear with why you want to do something in your life or why that specific thing is the one for you, you get so much more determined, focused that you become unstoppable. You don't have to know everything when you start but you will have to eventually start somewhere to do, experiment, succeed, fail, learn, and keep on doing it, till you do things differently and reach a level of excellence. Remember that our visions should always be bigger than our capabilities and goals as small as possible. It's only when you dream for something bigger than your current potential that you tend to stretch yourself out of your comfort zone and grow. Even the biggest of visions can be achieved if we break them down into small actionable goals. What you don't want is to overload yourself with big goals that are set out to be achieved in a shorter period of time as not seeing your goals accomplished might also come as a turn-off. So the best way forward would be to become self-aware of your limitations and start breaking it slowly, little by little.  End note: Hope this has brought you some value and helped you in paying attention to some key aspects of your life. We recommend you to go through our 7-DAY program if you need deeper insights about yourself and you can even book a session with us to build visions and goals around the areas that need maximum sorting in your life. For booking your session please check the availability here.",
};

const INTENSIVE_ARTICLES = [
  {
    dayNumber: 1,
    title: "KNOWING YOURSELF",
    body: "Each one of us is unique in our own ways, we are made up of our beliefs, values, achievements, failures, emotions, understanding, lessons and much more. Thus, never consider yourself as a product of what you achieve, success is just a small part of it. Life is like a double sided coin, which offers us both happiness and sadness, success and failures. Life keeps tossing. If you are having a hard time, remember that the next toss is on its way. Our lives are our lives, stop defining yourself with what others have to say and think about you. Have a vision, a belief that no matter what happens in life you will never let self-doubt and other's opinion be the roadblock to your success. You have to be the hero of your own story, own it. Failures are just present for us to take a pause, think of what went wrong and do it again, with more experience. The great cannot be simply achieved in one simple move. Just like the game of chess, you win some moves, you lose some but what makes you the ultimate winner is how you deal with those failed moves, failures and make a comeback. It's all about what you feed your mind in every minute of the game, every minute of your life. To win the match learn from your failures and make a better move in next turn. And to win the match you don't need anyone else but 100% of you. Fight your fears, kill your limiting beliefs and look up to people who inspire you, if they did it, so can you. No one can dream big for you, to live a life you want to be proud of, start taking actions. No matter how big it is, they will all start from a small place. Don't be shy of starting small, be excited to get bigger. Go live, to inspire.",
  },
  {
    dayNumber: 2,
    title: "IQ, EQ, SOCIETY, RELATIONS",
    body: "In a life as a human our attention is always diverted in our self, work and people around us. While our IQ  builds us up to stand and understand the talk of the hour, our EQ shapes us as a human being. In a world, where you can be anything, be kind. This line says it all, no matter what you do and have in your life. One thing that should be the biggest component of you is your empathy, kindness and generosity. Everyone is fighting his or her own battle that we can't see, instead of giving them our anger and piece of frustration, give them love, care and you can start with a smile. No matter what you achieve in life, your success will always be incomplete if you had no one around you to share it with, celebrate it. Life is small and unpredictable and you don't want to live it fulfilling someone else's dream. Live your life on your terms, for yourself. People will keep influencing you, dominating you, persuading you but never end up doing something you don't truly feel for. In times of doubt and a situation when you have to choose, just think that if today was the last day of your life, how will you live it ? And what would you do, if you were given a second chance tomorrow ? Would you live your dreams or would you die living that of others. Sometimes we do things to please people we love but this would never work in the long run. If you love pleasing people and not yourself and you are okay with it, than it is fine but if that frustrates you than stop it right away. Don't be under any pressure, don't listen to people's opinion of you, they keep changing. Their opinions will never stop and you shouldn't stop as well, in pursuing your dreams. Keep chasing your ambitions, you've got only one life to live. Don't let anyone get in between of, who you want to be and all that you want to achieve. Our lives are filled with humans, tangled  in form of various relations. When life gets little tricky and inconvenient we tend to let go of those who created those situations ; what you need to understand is that in life there would never be a person who would be ideal for you, for any relation. Being with someone is a journey of understanding the person and ourselves. There will be people who would hurt you, make you toxic, not meant to be with you, let go of them. But for small pains or misunderstanding or your inconvenience, don't let go of people who really care for you and go out of their way to keep a check on you. It all comes down to how much are you willing to give in, sacrifice, prioritize but remember in order to be there for others, don't you ever forget to be there for yourself. You need yourself the most and likewise others do the same.",
  },
  {
    dayNumber: 3,
    title: "HEALTH & FITNESS",
    body: "What is life without health ? Can you imagine a life lived in sickness ? Remember the last time you fell ill and the world lost all its colours. A life without health in pain is worse than death. Being healthy and living a healthy life should be our priorities yet we take it for granted and don't take the necessary actions for it. If you aren't fat or have a body in shape, doesn't mean that you are fit. It's a situation where you are at least better off than other people but you still need to take minimum steps to keep yourself healthy and fit. And when we talk about health it's not just our physical health but mental health as well. In our nation, it's slowly being addressed but still the uneducated masses are not aware of it, while educated don't consider it important enough to take actions. A healthy mind is more important than a healthy body as it helps us to stay positive and strong in our illness. While everyone has heard precaution is better than cure, not everyone is ready to even cure their health. We've taken our body for go granted that we prefer using 45 mins of Instagram than any daily exercise routine. We all know the benefit of having a healthy lifestyle, importance of exercise yet we ignore it waiting for the time when our body gets fed up and reacts in form of illness. Just imagine a day when you have all that you ever asked for but not a healthy body to enjoy it. Having it all and still not being able to do anything. While now you might not have all that you desire but a fitter you would definitely be the fastest to reach there. Staying fit and healthy is not a choice, it's a must, for a beautiful life. Take care today to live healthy and wealthy tomorrow.",
  },
  {
    dayNumber: 4,
    title: "CAREER & FINANCE",
    body: "We are known by our work, what we do in our lives ends up shaping us as a person. In a life when we would be spending the majority of our time working, it should revolve around something we love. Imagine 8-10 hrs of your day, every single day spent on an activity that isn't of your interest and doing it over and over again. What good is money if it cannot give you joy and satisfaction ? Yes money can't buy everything and that's the point, it shouldn't be the ultimatum. It's often said doing something should either give you money, happiness, growth or learning. While eventually whatever new we do, teaches us but it means to keep pushing ourselves and while we do so, there's nothing better than growing in what you love doing. One life, what all we can become ? Where all it can take us yet we are simply living our ordinary lives. Why are we stopping ourselves from living an extra-ordinary life ? Not everyone can have it, is a lie. We can all have all that we desire, all of it just not all at once. And that is how it works but what we need to realise is, we aren't dreaming big enough and even if we are, we are not executing at our best. As, if we were, we won't be introspecting our lives right now but rather be filled with gratitude and would be helping others achieve their dreams. What life asks from us is, to take consistent, considerable action. We don't get passionate for things instead we do things with passion. You can live the life that you want, just start thinking and believing in what you want and when you know it, don't stop, don't give up. Enjoy the journey, your journey should be your reward and not your end destination. Rest all will be taken care of.",
  },
  {
    dayNumber: 5,
    title: "SPIRITUALITY",
    body: "Right from our birth to our very existence we know there's always been a higher energy, that's around us. One which guards us but what we unintentionally fail to learn, even when we grow up is that energy is also within us and in all of us.\n\nSpirituality is the awakening of that source of energy, it is much more than just worshipping of god, it is about realizing our infinite inner potential. It is more to do with the self, knowing, and diving deep in our souls. It's about understanding ourselves and exploring our strengths. It's about igniting the energy within us that allows us to absorb the positivity around us and radiating the same. It's about being calm and composed. It's about choosing love over hatred. It is about being grateful and appreciating ourselves and our lives. It's about learning the ability to know, understand, and apply wisdom in our lives and to be able to share it through our actions.\n\nThe only essence of spirituality is to give us the ability to channelize the infinite energy around and within us. I want to ask if you have an opportunity to be a better human, to live an extraordinary life and you have a tool to expand your potential, build your confidence, courage, positivity, optimism, to shape your life for better, would you not take the tool to turn your life around?\n\nIt's only when we see that there's more to life than we think, we realize what art of living truly means.",
  },
  {
    dayNumber: 6,
    title: "QUALITY OF LIFE, LIFE VISIONS",
    body: "Our life is majorly divided between our personal & professional growth and our relationships in society. All the categories play an essential role in our lives be it our IQ, EQ, Health, Finance, Self, spirituality, relations. We all have a desire to grow and outdo ourselves, in all these categories. Now the more you expect out of each of them, the more you have to give in. Also, if we want to be happy, it's better to not expect and keep executing until you've reached a satisfactory point. That point is often defined by our vision. We need to have a vision in all these essential fields of life. The clearer the vision, the easier it is to plan and execute, so it's important to be as specific as possible. Without a vision, we can just accept life and do the best with what comes our way but with a clear vision in mind, we can even set out to achieve what once we thought was unachievable.\n\nHaving everything balanced is a myth. It takes sheer patience, commitment, and discipline to keep a balance between all aspects of life. Naturally, there is just a portion of people who have balanced their lives after decades of perseverance. Life is all about learning to find a balance and living happily while at it.\n\nThe better you do the better you get. The more attention you give, in whichever area, the more you contribute towards your growth. While we have our lives to master, we can start with a will to live a balanced one.",
  },
  {
    dayNumber: 7,
    title: "END GAME",
    body: "Nothing beats consistent, disciplined, and committed actions. These three words right here depict the very essence of hard work. It isn't easy to be consistent, disciplined, and stay 100% committed. The one who does these things with passion, love, zest, and zeal gets what he or she desires. You must do something exhilarating to find your passion and love doing it. It's harder to do hard work when you are working day and night on something you don't like or believe in or something you feel isn't worth your time and energy.\n\nWe as humans, all together have 24 hours a day but what we make out of that time depends on all of us. Our vision, clarity, focus, commitment, planning, and daily execution build us and our future. That's why every minute is valuable when you know what it can bring to you. Knowing the actual value of our time isn't easy but give it a thought. How much value does your 1 minute hold to the world and you? What are you giving to yourself or the rest of the world in this 1 minute? This makes us think of how much we indeed are using our time.\n\nUtilizing time doesn't always have to be work-oriented but it can revolve around all these 5 categories. A minute in your life can be a call to an old friend, just to catch up. A minute in your life can be an appointment call. A minute in your life can be praying and being grateful. A minute in your life can be hugging a person you love. A minute can be listening to music you like. A minute can be closing your eyes and taking a few deep breaths. A minute can be holding a yoga posture. A minute can be a walk in your balcony. A minute can be reading a quote. A minute can be ticking off your to-do-list. A minute can be cleaning your desk.\n\nTo imagine a minute can have infinite possibilities it could help you love, bond, connect, do, and be more. And we have just talked about a minute after which I want you to imagine what 1 hour or 1 day of our lives could be like. So many hours, minutes, seconds and they all don't have to be the same. The activities that bring us joy, excitement, growth, money, and experience should be undertaken. If we imagine it this way, there's a lot that we can do and achieve in this one life. It is all possible, it only asks us to dream big and have the courage to run towards our dreams, run together, live, and enjoy living the run together.\n\nDon't live in thoughts, doubts, opinions, failures, past, future. Live in the present, live in this moment, do something to be happy now, not later, not tomorrow but now. Plan your day, plan your life, do your best, know yourself, explore your potential, dream, make it happen. No one is promised tomorrow, do your best today and live it fully. Whatever happens tomorrow, happens tomorrow, don't spend your now, thinking, worrying about tomorrow.\n\nBe your own hero, be proud of yourself, not just for your success but for your everyday progress too, that's a success, cherish it, enjoy and celebrate your everyday victories, leave nothing for tomorrow, live now to the fullest and it will leave you with no room for regrets tomorrow. Learn, unlearn, ride, dive, jump, crawl, lay, dream, achieve, live, breathe, smile, laugh, enjoy, feel joy, love, go deep, romance, bromance, don't miss a chance, forgive, forget, be kind, give, share, you care, gratitude is the real attitude. Be, live, do more.\n\nYou only live once, Live it fully. You are enough. Go. Dream. Do. Be. Live. Inspire.\n\nEnd Note: Hope this brought you value in some way and helped you a bit in paying attention to some key areas of your life. We recommend you to go ahead to step 3 of this program and book a one-on-one session with us to complete your program and build daily actionable goals around the visions that you have created in each key area, especially in that one area that needs maximum sorting.\n\nRemember: Completion of the SOS Program makes you more eligible to all the opportunities listed on our platform, as the report and session completion certificate helps us better to recommend you first to our community partners.\n\nFor booking your session please check the availability here.",
  },
];

const upsert = async (program, article, adminId) => {
  const existing = await SOSArticle.findOne({
    programId: program._id,
    dayNumber: article.dayNumber,
  });

  const label = "day " + article.dayNumber + ' "' + article.title + '" (' + words(article.body) + " words)";

  if (!APPLY) {
    console.log("  [dry] " + (existing ? "UPDATE " : "CREATE ") + label);
    return;
  }

  if (existing) {
    existing.title = article.title;
    existing.body = article.body;
    existing.isActive = true;
    existing.updatedBy = adminId;
    await existing.save();
    console.log("  updated " + label);
    return;
  }

  await SOSArticle.create({
    programId: program._id,
    dayNumber: article.dayNumber,
    title: article.title,
    body: article.body,
    isActive: true,
    createdBy: adminId,
  });
  console.log("  created " + label);
};

const seed = async () => {
  await mongoose.connect(MONGODB_URL);
  console.log(APPLY ? "*** APPLY MODE ***" : "--- DRY RUN (set APPLY=yes to write) ---");
  console.log("");

  const Admin = mongoose.model("Admin", new mongoose.Schema({}, { strict: false }), "admins");
  const admin = await Admin.findOne({});
  if (!admin) {
    console.error("No admin found in the database.");
    process.exit(1);
  }

  const simpleProgram = await SOSProgram.findOne({ type: "GSOS", isActive: true });
  const intensiveProgram = await SOSProgram.findOne({ type: "ISOS", isActive: true });

  if (!simpleProgram) {
    console.error("No active GSOS program found.");
    process.exit(1);
  }
  if (!intensiveProgram) {
    console.error("No active ISOS program found.");
    process.exit(1);
  }

  console.log("Simple SOS   : " + simpleProgram.title + " (" + simpleProgram.durationDays + " day)");
  await upsert(simpleProgram, SIMPLE_ARTICLE, admin._id);
  console.log("");

  console.log("Intensive SOS: " + intensiveProgram.title + " (" + intensiveProgram.durationDays + " days)");
  for (const article of INTENSIVE_ARTICLES) {
    if (article.dayNumber > intensiveProgram.durationDays) {
      console.log("  skipped day " + article.dayNumber + " - beyond program duration");
      continue;
    }
    await upsert(intensiveProgram, article, admin._id);
  }

  console.log("");
  if (APPLY) {
    const all = await SOSArticle.find({}).populate("programId", "title").sort({ dayNumber: 1 });
    console.log("VERIFY: " + all.length + " article(s) in the database");
    all.forEach((a) => {
      console.log("  [" + (a.programId ? a.programId.title : "?") + "] day " + a.dayNumber + " - " + a.title + " (" + words(a.body) + " words, active=" + a.isActive + ")");
    });
  }

  await mongoose.disconnect();
  console.log("Done.");
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

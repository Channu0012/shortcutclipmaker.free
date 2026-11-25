from typing import Dict, Any, List


def _build_words(text: str, start: float, end: float) -> List[Dict[str, Any]]:
    raw = text.split()
    if not raw:
        return []
    step = max(0.12, (end - start) / len(raw))
    return [
        {
            "word": tok,
            "start": round(start + idx * step, 2),
            "end": round(start + (idx + 1) * step, 2),
        }
        for idx, tok in enumerate(raw)
    ]


DEMO_METADATA: Dict[str, Dict[str, Any]] = {
    "creator-podcast": {
        "id": "demo_podcast_01",
        "title": "Mastering The Creator Economy & High-Retention Video",
        "duration": 620,
        "channel": "NextGen Creator Studio",
        "thumbnail": "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=800&q=80",
        "subtitles": ["en"],
        "is_demo": True,
        "source_type": "demo",
    },
    "mastering-creator-economy": {
        "id": "demo_podcast_01",
        "title": "Mastering The Creator Economy & High-Retention Video",
        "duration": 620,
        "channel": "NextGen Creator Studio",
        "thumbnail": "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=800&q=80",
        "subtitles": ["en"],
        "is_demo": True,
        "source_type": "demo",
    },
    "huberman-dopamine": {
        "id": "demo_huberman_01",
        "title": "Controlling Your Dopamine For Motivation, Focus & Drive",
        "duration": 500,
        "channel": "Neuroscience Lab Podcast",
        "thumbnail": "https://images.unsplash.com/photo-1559757175-5700dde675bc?w=800&q=80",
        "subtitles": ["en"],
        "is_demo": True,
        "source_type": "demo",
    },
    "hormozi-offers": {
        "id": "demo_hormozi_01",
        "title": "How To Build An Irresistible $100M Value Offer",
        "duration": 410,
        "channel": "Acquisition Strategy Live",
        "thumbnail": "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&q=80",
        "subtitles": ["en"],
        "is_demo": True,
        "source_type": "demo",
    },
}


DEMO_SCRIPTS: Dict[str, List[tuple]] = {
    "huberman-dopamine": [
        (8.0, 14.0, "Here is the uncomfortable neuroscience truth about motivation and dopamine:"),
        (14.0, 21.0, "Dopamine is not just about pleasure — it is your currency for craving and drive."),
        (21.0, 28.0, "Every time you spike dopamine artificially, your baseline drops lower than before!"),
        (28.0, 36.0, "Stop stacking five stimulants before noon if you want sustainable daily focus."),
        (50.0, 56.0, "Why 90% of people feel exhausted even after eight hours of sleep?"),
        (56.0, 63.0, "Because they check bright phone notifications within 60 seconds of waking up."),
        (63.0, 70.0, "Wait until you get 10 minutes of natural outdoor sunlight in your eyes first."),
        (70.0, 78.0, "That single circadian reset changes everything about your afternoon energy."),
        (95.0, 102.0, "Think about intermittent reward schedules in work and deep focus blocks:"),
        (102.0, 109.0, "Never attach external celebration to every single milestone you hit."),
        (109.0, 117.0, "Instead, teach your nervous system to love the friction of hard mental effort!"),
        (117.0, 125.0, "When you enjoy the struggle itself, nobody in the market can outwork you."),
        (140.0, 147.0, "The secret protocol for overcoming a severe afternoon crash takes 90 seconds:"),
        (147.0, 155.0, "Cold water immersion elevates norepinephrine and dopamine by 250 percent!"),
        (155.0, 163.0, "And unlike caffeine, it produces a clean upward arc with zero afternoon crash."),
        (163.0, 172.0, "Master your neurochemistry and consistency becomes practically effortless."),
        (190.0, 197.0, "The worst thing you can do during a deep work bout is open another tab."),
        (197.0, 205.0, "Context switching takes your brain up to 23 minutes to rebuild full momentum."),
        (205.0, 214.0, "Put the phone in another room for 90 minutes and watch your output 10x."),
        (230.0, 238.0, "Listen to this sleep architecture insight nobody talks about enough:"),
        (238.0, 246.0, "Deep slow-wave sleep in the first half of the night repairs physical muscle tissue."),
        (246.0, 255.0, "REM sleep in the final two hours cements memory and emotional resilience!"),
        (275.0, 283.0, "How do world-class performers recover mentally between high-stress sprints?"),
        (283.0, 291.0, "They practice 10 minutes of non-sleep deep rest to replenish striatal dopamine."),
        (310.0, 318.0, "Stop consuming endless productivity hacks without executing a single protocol."),
        (318.0, 326.0, "Sunlight, hydration, delayed caffeine, and friction — start today and track 14 days!"),
        (350.0, 358.0, "Here is what happens to brain plasticity after age 25 if you stay passive:"),
        (358.0, 366.0, "Error and frustration trigger acetylcholine, which marks circuits for rewiring."),
        (390.0, 398.0, "Every uncomfortable rep is literally the chemical signal that growth has begun!"),
        (420.0, 428.0, "Breathe twice in through the nose, long exhale out — the physiological sigh."),
        (428.0, 436.0, "Two cycles immediately drop heart rate via vagal nerve feedback in 15 seconds."),
        (460.0, 469.0, "Most people fail because they expect effortless motivation before taking action."),
        (469.0, 478.0, "Action comes first. Neurochemistry adapts to motion. Start today and win!"),
    ],
    "hormozi-offers": [
        (8.0, 14.0, "Here is why 95% of businesses compete on price and stay completely broke:"),
        (14.0, 21.0, "They sell the exact same commodity product as everyone else in their city!"),
        (21.0, 28.0, "If people can compare your price apples-to-apples, you have already lost."),
        (28.0, 36.0, "Create a Grand Slam Offer so good people feel stupid saying no to it!"),
        (50.0, 57.0, "The Value Equation has only four variables you need to obsess over:"),
        (57.0, 64.0, "Dream outcome times perceived likelihood of achievement, divided by time delay and effort."),
        (64.0, 72.0, "To double your price tomorrow, don't add random features — shrink the time delay!"),
        (72.0, 80.0, "Give customers a fast win within 48 hours and watch churn drop to zero."),
        (95.0, 102.0, "Stop calling your service a commodity retainer for 500 dollars a month."),
        (102.0, 110.0, "Guarantee the specific result, stack bonuses that solve every downstream obstacle!"),
        (110.0, 118.0, "When you eliminate risk for the buyer, conversion rates literally triple overnight."),
        (135.0, 142.0, "Most founders ask how to get more leads when their real bottleneck is volume."),
        (142.0, 150.0, "Rule of 100: do 100 outreach actions or 100 minutes of content every morning!"),
        (150.0, 158.0, "Do that unbroken for 100 days before you ever judge whether the niche works."),
        (175.0, 182.0, "Why premium clients pay 10x more without blinking an eye?"),
        (182.0, 190.0, "Because high-status buyers value speed and certainty ten times over saving money."),
        (190.0, 198.0, "Raise your prices until 30 percent of prospects push back — that is your true tier!"),
        (215.0, 223.0, "The biggest mistake in sales calls is pitching before diagnosing pain."),
        (223.0, 231.0, "Let the prospect tell you why their current system is costing them a fortune."),
        (231.0, 240.0, "Once they quantify the cost of inaction, your offer pays for itself automatically."),
        (260.0, 268.0, "Urgency and scarcity only convert when they are 100% genuine and concrete!"),
        (268.0, 276.0, "Cap onboarding cohorts based on fulfillment capacity so every client gets results."),
        (300.0, 308.0, "Focus on one avatar, one problem, and one scalable delivery vehicle until $1M/year."),
        (308.0, 316.0, "Complexity is the silent killer of execution — simplify ruthlessly and win!"),
        (340.0, 349.0, "Think about attention as compounding equity rather than disposable ad spend."),
        (349.0, 358.0, "Long-form podcasts carve into 20 viral shorts that sell for you 24 hours a day."),
        (380.0, 390.0, "Make more offers, document real proof, and never negotiate against your own worth!"),
    ],
    "creator-podcast": [
        (10.0, 16.0, "The number one reason 99% of creators fail in the first 90 days is simple:"),
        (16.0, 22.0, "they obsess over perfection before they have ever achieved consistency."),
        (22.0, 28.0, "They spend three months designing a logo and choosing the mic,"),
        (28.0, 34.0, "and then they quit after their third video gets only twelve views!"),
        (34.0, 40.0, "Volume creates skill. Skill creates quality. And quality creates audience."),
        (50.0, 56.0, "Here is the uncomfortable truth nobody wants to admit out loud:"),
        (56.0, 62.0, "Your first 50 videos are going to be terrible. And that is totally okay!"),
        (62.0, 68.0, "Every single master you look up to today started with awkward audio."),
        (68.0, 75.0, "Hit record, post it, learn from it, and do it again tomorrow."),
        (100.0, 106.0, "If you want superhuman focus, you need to fix your morning dopamine spikes."),
        (106.0, 112.0, "The worst thing you can do when you wake up is reach for your smartphone."),
        (112.0, 118.0, "When you open social media in bed, you flood your brain with cheap novelty,"),
        (118.0, 125.0, "and you drain all the cognitive drive you needed for deep creative work."),
        (150.0, 156.0, "Look at how Gary Vee dominates every single platform simultaneously."),
        (156.0, 162.0, "He doesn't sit down and create 50 separate individual posts every day."),
        (162.0, 168.0, "He records one hour of high quality conversation, and his team carves it up."),
        (168.0, 174.0, "They extract 30 vertical shorts, 10 quote graphics, and 5 newsletter articles."),
        (174.0, 180.0, "Stop creating from scratch. Document your thinking and repurpose ruthlessly!"),
        (210.0, 216.0, "If you don't hook the viewer in the first 3 seconds, the algorithm kills your reach."),
        (216.0, 222.0, "Never start a short saying 'Hey guys, welcome back to my channel today'."),
        (222.0, 228.0, "Start in the middle of the action. Start with an unbelievable statement!"),
        (228.0, 234.0, "Give them a reason to stay for the next 15 seconds, and then deliver."),
        (234.0, 240.0, "Pacing is retention. Retention is watch time. Watch time is distribution."),
        (270.0, 276.0, "Why is most editing advice on Twitter complete and utter garbage?"),
        (276.0, 282.0, "Because people spend 8 hours adding motion graphics to a boring script!"),
        (282.0, 288.0, "If your core idea doesn't make someone stop and gasp, no neon glow will save you."),
        (288.0, 294.0, "A great story recorded on a 10-year-old iPhone will beat a boring 4K clip every time."),
        (294.0, 305.0, "Storytelling beats production value. Focus on what makes people feel alive."),
        (330.0, 336.0, "The internet rewards extreme asymmetry like nothing in human history."),
        (336.0, 342.0, "A single 45-second short can reach 5 million people while you are asleep."),
        (342.0, 348.0, "Thirty years ago, getting that reach required a million-dollar TV broadcast contract."),
        (348.0, 355.0, "Today, the distribution is free. The only bottleneck is your own audacity."),
        (380.0, 386.0, "The most expensive thing in the creator economy is hesitation."),
        (386.0, 392.0, "Every month you wait to start posting, the competition increases by 10%."),
        (392.0, 398.0, "Algorithms mature. Formats saturate. And audience attention moves."),
        (398.0, 408.0, "Start messy. Start today. Perfect is the enemy of profitable."),
        (430.0, 436.0, "The YouTube algorithm is not a math test designed to punish you."),
        (436.0, 442.0, "The algorithm is simply a reflection of human psychology and curiosity."),
        (442.0, 448.0, "If viewers click and stay, the algorithm pushes the video to more people."),
        (448.0, 455.0, "Stop trying to hack the machine. Learn how to captivate a human being."),
        (480.0, 486.0, "The secret of every viral hook is opening an irresistible curiosity loop."),
        (486.0, 492.0, "When you show someone the consequence before revealing the cause,"),
        (492.0, 498.0, "their brain cannot look away until the loop is closed and resolved."),
        (498.0, 506.0, "Master the curiosity loop, and you will never struggle for views again."),
        (530.0, 536.0, "AdSense is the lowest margin business model in the creator universe."),
        (536.0, 542.0, "If you rely solely on YouTube checks, you are on an endless hamster wheel."),
        (542.0, 548.0, "Build owned distribution: an email list, digital products, and high-ticket offers."),
        (548.0, 558.0, "A creator with 10,000 true fans can make 10x more than a creator with 1 million views."),
        (580.0, 586.0, "If you improve just one element of your video by 1% on every single upload:"),
        (586.0, 592.0, "your hook, your pacing, your lighting, your sound design, your delivery,"),
        (592.0, 598.0, "after 100 uploads, your content isn't 100% better. It is 270% better!"),
        (598.0, 608.0, "The compounding effect of relentless iteration is virtually unstoppable."),
    ],
}


def resolve_demo_slug(url: str) -> str:
    if not url or not url.startswith("demo://"):
        return "creator-podcast"
    slug = url.split("demo://", 1)[1].strip("/").lower()
    return slug if slug in DEMO_METADATA else "creator-podcast"


def get_demo_info(url: str) -> Dict[str, Any]:
    slug = resolve_demo_slug(url)
    return dict(DEMO_METADATA[slug])


def get_demo_transcript(url: str) -> List[Dict[str, Any]]:
    slug = resolve_demo_slug(url)
    script_key = "creator-podcast" if slug == "mastering-creator-economy" else slug
    rows = DEMO_SCRIPTS.get(script_key, DEMO_SCRIPTS["creator-podcast"])
    return [
        {
            "start": st,
            "end": en,
            "text": txt,
            "words": _build_words(txt, st, en),
        }
        for st, en, txt in rows
    ]

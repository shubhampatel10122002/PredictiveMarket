/* =====================================================================
   LaunchJustice Live — the scenario
   ---------------------------------------------------------------------
   The simulation is this file. Three fictional cases, what happens to
   each of them and when, and how every event moves the odds. Edit the
   words, the times or the numbers here and the whole run follows; the
   engine (engine.js) and the screens (sim.js) hold no story of their own.

   Everything here is invented: the cases, the people, the companies, the
   numbers. The legal mechanics are real ones (citizens' suits, diligent
   prosecution, HIPAA having no private right of action, class
   certification), because a story that gets those wrong would cost the
   simulation the people it is meant to convince.

   Time is in seconds of a ten-minute run at normal speed. The calendar
   maps the same ten minutes onto four years, January 2027 to December
   2030, so an event at t=300 lands in January 2029.

   Every event can carry:
     tag     what kind of moment it is: Client interview, Deposition...
     major   true to stop the room: a card with the clip slides in
     stage   index into `stages`, where the case is from here on
     odds    {win, settle} from here on; lose is whatever is left
     mood    how the crowd takes it, -0.3..0.3; fades with a 45s half-life
     crowd   {waitlist, sellers, watching}, people it moves
     impact  a change in the world this case can now claim
     end     "win" | "settle" | "lose" on the event that resolves a case
     embed   a YouTube (or Shorts) link for this moment's clip. Leave it
             out and the event borrows one of `clips`, in turn.
   ===================================================================== */

/* The simulation's own categories. The three colours were picked as a set
   and checked for colour-blind separation against both page backgrounds,
   because the three cases are drawn side by side as lines on one chart.
   sim.css carries the same three, stepped for dark mode. */
CATS.sim_env     = {label:"Environment",   color:"#16784F"};
CATS.sim_health  = {label:"Health equity", color:"#2F6FE0"};
CATS.sim_privacy = {label:"Privacy",       color:"#D9479A"};

const SCENARIO = {
  credits: 1000,          /* what every investor starts with */
  length: 600,            /* seconds, at 1x */
  calendar: {year:2027, month:0, months:48},
  exitDiscount: 0.10,     /* selling early costs 10% of the market price */
  stages: ["Funding", "Investigation", "Motions", "Discovery", "Settlement or trial", "Outcome"],

  /* Placeholder footage until each moment has its own clip: the YouTube
     Shorts already on the platform (the housing case's five). An event with
     its own `embed` uses that instead. */
  clips: [
    "https://www.youtube.com/embed/TJzJRMGMzwc",
    "https://www.youtube.com/embed/V40G7NCLjYI",
    "https://www.youtube.com/embed/O653XBKHcPc",
    "https://www.youtube.com/embed/zZdc11gkti0",
    "https://www.youtube.com/embed/m8zJ4kpz-oE"
  ],

  /* ---------------------------------------------------------------------
     The cases
     target      the whole litigation budget, raised before the case starts
     raise       [t, share of target] the crowd has put in by then; the
                 user's credits come on top, so they can close a round early
     winMult     what a credit in the round pays on a win
     settleMult  what it pays on a settlement
     odds        at launch; chance to win is win + settle, as on the site
     launchMood  how hot the stake trades when the market opens
     vol         how much the price wanders between events
     ticket      the average crowd investment, for counting backers
     --------------------------------------------------------------------- */
  cases: [
  {
    id:"eastbrook", cat:"sim_env", short:"Waste plant", motif:"plant",
    head:"The waste plant next to Eastbrook's school broke the rules 312 times. It never shut down.",
    title:"Make Marlow Creek clean up Eastbrook",
    caseName:"Eastbrook Neighbors United v. Marlow Creek Waste Recovery, LLC",
    court:"U.S. District Court", defendant:"Marlow Creek Waste Recovery, LLC",
    ngo:"Eastbrook Neighbors United, with the Clean Air Justice Clinic",
    target:150000, winMult:3.2, settleMult:1.5,
    odds:{win:.20, settle:.36}, impact:81,
    launchMood:.02, vol:.012, ticket:118,
    raise:[[0,0],[10,.06],[30,.30],[50,.55],[70,.82],[88,1]],
    crowd:{watching:2400},
    fundedNote:"The lawyers start work on Monday.",
    facts:[["312","violations in five years"],["400 ft","from the plant fence to the school"],["3×","the county's childhood asthma rate"]],
    summary:["Eastbrook is a mostly Black and Latino neighbourhood of 6,200 people on the east side of the river. The Marlow Creek plant, which treats and stores hazardous waste, sits 400 feet from its elementary school.",
             "State inspections logged 312 violations in five years: open burning, leaking drums, falsified shipping logs. The fines came to $40,000 in total. The suit asks the court to order a full cleanup under federal hazardous-waste law, and asks a jury for damages, medical monitoring, and the value of homes that can no longer be sold."],
    people:{
      plaintiff:{name:"Gloria Haynes", role:"Lead plaintiff", bio:"Retired school nurse, 67. Has lived on Kessler Street for 38 years, and kept a notebook of every 'orange day' since 2023."},
      attorney:{name:"Danielle Brooks", role:"Lead counsel, Clean Air Justice Clinic", bio:"Environmental litigator for 19 years. Has taken two hazardous-waste cases to a jury verdict."}
    },
    budget:[["Expert testing and hydrology",52000],["Attorney time",61000],["Depositions and discovery",22000],["Trial costs",15000]],
    outcomes:"A verdict pays backers 3.2× from damages and punitive damages. A settlement pays about 1.5×. A loss pays nothing."
  },
  {
    id:"lakeshore", cat:"sim_health", short:"Lung tests", motif:"lungs",
    head:"Three tests said Jalen's lungs were fine. The software was grading him by race.",
    title:"End race-based lung testing for children",
    caseName:"Mitchell v. Lakeshore Children's Health and Pulmara Diagnostics, Inc.",
    court:"State Superior Court", defendant:"Lakeshore Children's Health; Pulmara Diagnostics, Inc.",
    ngo:"Families for Fair Diagnosis",
    target:120000, winMult:2.6, settleMult:1.7,
    odds:{win:.18, settle:.42}, impact:86,
    launchMood:0, vol:.010, ticket:96,
    /* Stalls 300 credits short so whoever is watching can close the round.
       If nobody does, an anchor backer takes the rest at 140s. */
    raise:[[0,0],[15,.05],[40,.22],[70,.52],[100,.83],[112,.9975],[139.9,.9975],[140,1]],
    crowd:{watching:1900},
    fundedNote:"Lakeshore's own nurses' union fund takes the last of the round.",
    facts:[["38,000","children tested since 2016"],["10–15%","lower 'normal' for Black children"],["2023","the year race left the standard equations"]],
    summary:["For decades, lung-function software 'corrected' for race. It expected Black children's lungs to be 10–15% smaller and Asian children's about 5% smaller, so a struggling child could still score 'normal'. Medical societies moved to race-neutral equations in 2023. Lakeshore's machines kept the old setting.",
             "The suit, for 38,000 children tested since 2016, claims negligence against the hospital system and a design defect against the software maker. It asks for re-testing, treatment and damages. The Chen family has joined for their daughter Mei, 11."],
    people:{
      plaintiff:{name:"Denise Mitchell", role:"Named plaintiff, for her son Jalen", bio:"School bus driver and mother of two. Jalen, 9, was told three times his lungs were fine. His fourth attack put him in intensive care."},
      attorney:{name:"Lena Park", role:"Lead counsel", bio:"Medical-negligence and civil-rights litigator for 15 years. Spent six years as a respiratory therapist before law school."}
    },
    budget:[["Pulmonology experts and re-scoring",38000],["Attorney time",52000],["Discovery and depositions",20000],["Class notice",10000]],
    outcomes:"A verdict pays backers 2.6×. A settlement pays about 1.7×, which is how most cases like this end. A loss pays nothing."
  },
  {
    id:"drugads", cat:"sim_privacy", short:"Drug ads", motif:"data",
    head:"Their Medicaid records were private. A drugmaker used them to sell a worse drug.",
    title:"Stop drugmakers mining Medicaid claims to target patients",
    caseName:"Doe v. Brenlow Pharmaceuticals, Quillon Data Partners and Harborline Health Plan",
    court:"State Superior Court", defendant:"Brenlow Pharmaceuticals; Quillon Data Partners; Harborline Health Plan",
    ngo:"Patient Privacy Project",
    target:90000, winMult:3.6, settleMult:1.6,
    odds:{win:.16, settle:.30}, impact:78,
    launchMood:.24, vol:.020, ticket:142,
    raise:[[0,0],[8,.15],[20,.42],[34,.74],[48,1]],
    crowd:{watching:5200},
    fundedNote:"The fastest round on the platform this year.",
    facts:[["212,000","Medicaid members in the data"],["$41","a month more than the generic"],["0","members who agreed to be targeted"]],
    summary:["Harborline, a Medicaid health plan, sold 'de-identified' claims data to a broker, Quillon, which matched it back to names. Brenlow used the lists to target ads for Xelvora XR, a pricier reformulation that did worse than the generic in its own trials, at patients in the state's lowest-income zip codes.",
             "The suit, for 212,000 plan members, claims violations of the state medical-privacy act and consumer-protection law. It asks for damages, an end to the targeting, and deletion of the matched records."],
    people:{
      plaintiff:{name:"Jane Doe 1", role:"Lead plaintiff, name withheld", bio:"Home health aide, 52, on Medicaid. The Xelvora ads started a week after a diabetes diagnosis she had told no one about."},
      attorney:{name:"Omar Siddiqui", role:"Lead counsel", bio:"Privacy class-action lawyer for 12 years. Brought the state's first case over resold health-claims data."}
    },
    budget:[["Data forensics",26000],["Attorney time",44000],["Experts on targeting and harm",14000],["Class notice",6000]],
    outcomes:"A verdict pays backers 3.6×, the most of the three, because the odds are the longest. A settlement pays about 1.6×. A loss pays nothing."
  }
  ],

  /* ---------------------------------------------------------------------
     What happens, in order. Majors are about twenty seconds apart through
     the middle of the run; minors fill the feed between them.
     --------------------------------------------------------------------- */
  events: [
  /* ---- funding minute: the drug case fills fast, the waste plant steadily ---- */
  {t:75, c:"drugads", tag:"Client interview", major:true, stage:1,
   title:"The analyst who built the target list comes forward",
   body:"A former Quillon data scientist explains how 'anonymous' Medicaid claims were matched back to names using pharmacy loyalty cards, and who asked for the lists.",
   odds:{win:.18, settle:.31}, mood:.08, crowd:{waitlist:80, watching:900}},

  {t:105, c:"eastbrook", tag:"Client interview", major:true, stage:1,
   title:"Gloria kept a notebook of 'orange days'. There were 212.",
   body:"Every time the smoke came over Kessler Street, Gloria Haynes wrote it down: the time, the smell, how many puffs her grandson needed from his inhaler. Three years, 212 entries. Her lawyers call it the best evidence they never had to pay for.",
   odds:{win:.22, settle:.38}, mood:.06, crowd:{waitlist:40, watching:500}},

  {t:126, c:"lakeshore", tag:"Explainer", major:true, stage:0, closeRound:true,
   title:"How a lung test can grade a child by race",
   body:"For decades the software expected Black children's lungs to be 10–15% smaller, and Asian children's about 5% smaller. So a child who couldn't breathe properly could still score 'normal'. This case needs its last credits before it can start.",
   crowd:{watching:700}},

  /* ---- investigation ---- */
  {t:150, c:"drugads", tag:"Evidence", major:true,
   title:"Leaked deck: 'Project Lantern — reach low-income, high-adherence members'",
   body:"The slides aim Xelvora XR ads at the state's poorest zip codes, 'where switching to generic is least likely'. It leads the evening news and buyers pile in. The price is running well ahead of the odds.",
   odds:{win:.20, settle:.32}, mood:.20, crowd:{waitlist:320, watching:3800}},

  {t:165, c:"eastbrook", tag:"Evidence", stage:1,
   title:"Independent tests find benzene at 9× the limit by the school fence",
   body:"Backers' money paid an outside lab to sample the air and soil at six points around the plant. The worst reading was at the playground fence.",
   odds:{win:.25, settle:.38}, mood:.05, crowd:{waitlist:30},
   impact:"Independent air and soil testing at six points around the plant"},

  {t:178, c:"lakeshore", tag:"Client interview", major:true, stage:1,
   title:"'Three tests said he was fine. Then the ambulance came.'",
   body:"Denise Mitchell's son Jalen was told three times that his lungs were normal. His fourth attack put him in intensive care for two nights. Re-scored without the race setting, all three tests show obstruction.",
   odds:{win:.20, settle:.44}, mood:.05, crowd:{waitlist:50, watching:600}},

  {t:196, c:"drugads", tag:"Filing", stage:2,
   title:"Suit filed for 212,000 Medicaid members",
   body:"Claims under the state medical-privacy act, consumer-protection law and HIPAA, against all three companies.",
   odds:{win:.20, settle:.32}, mood:.03},

  {t:208, c:"eastbrook", tag:"Motion", major:true, stage:2,
   title:"The state files its own case. The company says that kills Eastbrook's.",
   body:"Federal law can block a citizens' suit when the government is already 'diligently prosecuting' the same violations. The state's case asks for a $40,000 fine and no cleanup. Marlow Creek has asked the judge to throw Eastbrook's suit out.",
   odds:{win:.19, settle:.33}, mood:-.10, crowd:{sellers:30}},

  {t:225, c:"lakeshore", tag:"Evidence", major:true,
   title:"Re-scored without race, 1 in 4 'normal' results weren't",
   body:"A pulmonologist re-ran 38,000 of Lakeshore's tests with race-neutral equations. For Black children, 26% of results marked normal now show disease. For Asian children, 11%.",
   odds:{win:.24, settle:.45}, mood:.08, crowd:{waitlist:90, watching:800},
   impact:"38,000 past lung tests re-scored without race"},

  /* ---- motions ---- */
  {t:242, c:"drugads", tag:"Ruling", major:true,
   title:"Judge: HIPAA gives patients no right to sue. The state claims survive.",
   body:"Only the government can enforce the federal health-privacy law, so that claim is out. What's left rests on the state privacy act, and that means proving the patients were harmed.",
   odds:{win:.15, settle:.29}, mood:-.10, crowd:{sellers:90}},

  {t:258, c:"lakeshore", tag:"Filing", stage:2,
   title:"Suit filed for 38,000 children. National health desks pick it up.",
   body:"The complaint names the hospital system for negligence and the software maker for a design defect.",
   odds:{win:.25, settle:.45}, mood:.04, crowd:{watching:1200}},

  {t:270, c:"eastbrook", tag:"Ruling", major:true,
   title:"Judge: a $40,000 fine is not 'diligent prosecution'. Eastbrook goes ahead.",
   body:"The motion to dismiss is denied. The judge calls the state's case 'a fine, not a fix'. Discovery opens next month.",
   odds:{win:.27, settle:.37}, mood:.08, crowd:{waitlist:60}},

  {t:285, c:"drugads", tag:"Settlement",
   title:"Harborline settles out: no more selling claims data, no money for the class",
   body:"The health plan agrees to stop selling member data. Brenlow and Quillon fight on, and the deepest pocket in the case is gone.",
   odds:{win:.13, settle:.25}, mood:-.04, crowd:{sellers:40},
   impact:"Harborline stops selling members' claims data"},

  {t:296, c:"lakeshore", tag:"Ruling", major:true,
   title:"The federal discrimination claim is dismissed. Negligence survives.",
   body:"The judge wants proof the hospital meant to discriminate, not just that its software did. The negligence and state civil-rights claims, which carry the damages, go forward.",
   odds:{win:.19, settle:.42}, mood:-.08, crowd:{sellers:40}},

  /* ---- discovery ---- */
  {t:320, c:"eastbrook", tag:"Deposition", major:true, stage:3,
   title:"Former shift lead: 'We buried the drums behind Building 4. At night.'",
   body:"Ray Delgado ran Marlow Creek's night shift for six years. Under oath, he marks on a map where the drums went, and names who signed the logs saying they had been shipped out.",
   odds:{win:.34, settle:.36}, mood:.10, crowd:{waitlist:90, watching:900},
   impact:"Radar survey ordered behind Building 4"},

  {t:342, c:"drugads", tag:"Hearing", major:true, stage:3,
   title:"At the class hearing, the judge asks: 'Where is the harm in seeing an ad?'",
   body:"The patients' lawyers point to the higher price and the stress of being singled out. The judge wants it proved patient by patient, and a class action only works if it can be proved once for everyone.",
   odds:{win:.10, settle:.20}, mood:-.10, crowd:{sellers:120}},

  {t:362, c:"lakeshore", tag:"Discovery", major:true, stage:3,
   title:"Internal email: going race-neutral 'would flag 30% more kids'",
   body:"Pulmara's product lead wrote it in 2023: 'Hospitals won't like the call volume.' The race-neutral update shipped that year as an option, switched off by default.",
   odds:{win:.26, settle:.50}, mood:.12, crowd:{waitlist:120, watching:1400}},

  {t:374, c:"lakeshore", tag:"Deposition",
   title:"Lakeshore's head of pulmonology: 'We didn't prioritise the 2023 guidance'",
   body:"She confirms she read it the month it came out.",
   odds:{win:.27, settle:.52}, mood:.04},

  {t:385, c:"drugads", tag:"Ruling", major:true,
   title:"Class certification denied",
   body:"Each of the 212,000 members would have to prove their own harm. Without a class, the case can't pay for itself.",
   odds:{win:.04, settle:.10}, mood:-.15, crowd:{sellers:200}},

  {t:402, c:"eastbrook", tag:"Deposition", major:true,
   title:"The plant manager says 'I don't recall' 47 times",
   body:"Including when he was asked whether he had ever been behind Building 4. The recording runs four hours. The jury will see the worst eleven minutes.",
   odds:{win:.38, settle:.36}, mood:.06, crowd:{waitlist:70}},

  /* ---- the endgame ---- */
  {t:424, c:"eastbrook", tag:"Settlement talks", major:true, stage:4,
   title:"Marlow Creek offers $18 million. Eastbrook votes 212 to 9 to go to trial.",
   body:"Settling would have paid backers about 1.5×. It wasn't their call: plaintiffs decide how a case is run, and backers don't get a vote. Trial raises the stakes both ways, a bigger award if the jury agrees and nothing if it doesn't.",
   odds:{win:.52, settle:.05}, mood:-.14, crowd:{sellers:80}},

  {t:446, c:"drugads", tag:"Dismissed", major:true, stage:5, end:"lose",
   title:"Case dismissed. Stakes in it pay nothing.",
   body:"With the class gone, the judge grants summary judgment against the named plaintiffs. This is how a litigation investment loses. It launched with the lowest chance to win of the three, and the most hype."},

  {t:458, c:"eastbrook", tag:"Ruling",
   title:"The judge throws out the company's toxicologist",
   body:"His model assumed the plant ran at a third of its logged volume. The jury won't hear it.",
   odds:{win:.58, settle:.04}, mood:.05},

  {t:470, c:"lakeshore", tag:"Settlement talks", stage:4,
   title:"Lakeshore and Pulmara agree to mediation",
   body:"A retired judge will run the talks, with both defendants in the room.",
   odds:{win:.18, settle:.66}, mood:.03},

  {t:480, c:"drugads", tag:"Aftermath",
   title:"The state Attorney General sues Brenlow, using this case's record",
   body:"Discovery made the documents public. The state doesn't have to prove harm patient by patient.",
   impact:"The Attorney General's own case, built on this one's record"},

  {t:494, c:"lakeshore", tag:"Settlement", major:true, stage:5, end:"settle",
   title:"Settled: $64 million, and every child gets re-tested",
   body:"A fund for families, free re-testing for all 38,000 children, and three years of controller medication for any child the new test flags. Backers are paid 1.7× what they put in.",
   impact:"Free re-testing for 38,000 children, and medication for those who need it"},

  {t:508, c:"eastbrook", tag:"Trial",
   title:"Trial opens. The jury sees the Building 4 photos.",
   body:"Forty-one drums, two of them split open, under eighteen inches of fill.",
   odds:{win:.61, settle:.04}, mood:.03},

  {t:522, c:"lakeshore", tag:"Aftermath",
   title:"Lakeshore drops race from every machine. Two more hospital systems follow.",
   body:"The settlement didn't require the other two. Their lawyers read the email.",
   impact:"Three hospital systems switch to race-neutral lung testing"},

  {t:538, c:"eastbrook", tag:"Trial", major:true, suspense:true,
   title:"Closing arguments are done. The jury is out.",
   body:"Eleven days of testimony and 214 exhibits. A verdict could come in minutes or take days, and the stake is trading on nerves.",
   odds:{win:.62, settle:.04}, mood:0},

  {t:560, c:"eastbrook", tag:"Verdict", major:true, stage:5, end:"win",
   title:"Verdict: $96 million for Eastbrook",
   body:"The jury finds Marlow Creek liable on every count, with punitive damages. The judge orders a full cleanup and ten years of free medical monitoring. Backers are paid 3.2× what they put in.",
   impact:"A full cleanup, and ten years of free health checks for residents"},

  {t:582, c:"eastbrook", tag:"Aftermath",
   title:"Cleanup crews arrive. The playground reopens.",
   body:"Marlow Creek stops taking waste. The elementary school uses its playground for the first time since 2024.",
   impact:"The school playground reopens"}
  ],

  /* ---------------------------------------------------------------------
     Six other investors playing the same ten minutes, for the leaderboard.
     They are simulated, they are named as such, and each one is a strategy
     rather than a person: [t, case, "in", credits | "all" | "half"] puts
     credits in (into the round while it is open, from an exiting backer
     after), [t, case, "out", share] sells that share of the stake.
     --------------------------------------------------------------------- */
  personas: [
    {id:"maya",  name:"Maya R.",  style:"The diversifier",
     says:"Three cases, three equal stakes, no peeking.",
     moves:[[5,"eastbrook","in",333],[5,"lakeshore","in",333],[5,"drugads","in",334]]},
    {id:"jonas", name:"Jonas K.", style:"The hype chaser",
     says:"Everyone was talking about the drug-data case. I went big.",
     moves:[[6,"drugads","in",600],[6,"eastbrook","in",200],[152,"drugads","in","all"]]},
    {id:"priya", name:"Priya S.", style:"The analyst",
     says:"Backed the two best odds, kept some back for a dip.",
     moves:[[12,"eastbrook","in",400],[12,"lakeshore","in",400],[426,"eastbrook","in","all"]]},
    {id:"theo",  name:"Theo B.",  style:"The cautious one",
     says:"I only put in what I could stand to lose.",
     moves:[[40,"eastbrook","in",200],[40,"lakeshore","in",200]]},
    {id:"ade",   name:"Ade O.",   style:"The early exit",
     says:"When the HIPAA claim died, so did my patience.",
     moves:[[8,"eastbrook","in",300],[8,"lakeshore","in",300],[8,"drugads","in",400],[244,"drugads","out",1]]},
    {id:"lin",   name:"Lin W.",   style:"The momentum trader",
     says:"Up, I buy. Down, I sell. Every time.",
     moves:[[10,"drugads","in",500],[10,"eastbrook","in",250],[10,"lakeshore","in",250],
            [244,"drugads","out",1],[322,"eastbrook","in","all"],[426,"eastbrook","out",1]]}
  ]
};

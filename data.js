/* =====================================================================
   LaunchJustice demo data
   ---------------------------------------------------------------------
   Everything in this file is fictional content written to show the product
   at full scale: the funding numbers, backer counts, discussion threads,
   ratings and scores are what a case would look like on a platform with
   millions of members. Nothing here is a real case, a real person or a
   real prediction.

   One rule keeps it honest: scores are DERIVED, never typed in. A case's
   chance-to-win is its base rate plus its factor deltas; its impact score is
   the weighted average of its impact factors. Change a factor and every
   screen that shows the score changes with it.
   ===================================================================== */

const CATS = {
  immigration:{label:"Immigration", color:"#2F5BEA"},
  environment:{label:"Environment", color:"#1F8A5B"},
  housing:{label:"Housing", color:"#8B5CF6"},
  labor:{label:"Workers' rights", color:"#D97706"},
  disability:{label:"Disability rights", color:"#0E7490"},
  privacy:{label:"Privacy", color:"#DB2777"}
};

/* Platform-wide numbers, shown on the Cases page so the demo reads as a
   running product rather than a prototype with six rows in it. */
const PLATFORM = {
  members: 2412880,
  committed: 318400000,
  casesFunded: 1847,
  resolved: 412,
  wins: 289,
  paidBack: 61200000,
  liveNow: 18640          /* people on the platform right now */
};

/* The six litigation stages from the business plan, with the share of a
   typical case each one takes. Durations are per case; these are defaults. */
const STAGES = ["Pre-filing","Pleadings","Discovery","Trial","Decision","Appeal"];

/* The payout split from the business plan. Kept in one place because it is
   shown in three: the returns section, the pledge sheet and the FAQ sheet. */
const SPLIT = {
  processingFee: 0.03,    /* taken out of funds raised */
  plaintiff: 0.53,
  platform: 0.06,         /* 5% platform fee + 1% contingent return */
  backers: 0.41
};

/* ---------------------------------------------------------------------
   Cases
   ---------------------------------------------------------------------
   hero.src points at a stock photograph. If it fails to load, or if you are
   offline, the app draws generated artwork in the case's colour instead, so
   the banner is never a broken image. Swap these for licensed photography
   before this goes in front of the public.

   clips[].src is where a real vertical video file or URL goes. Until one
   exists, the clip plays as an animated caption card built from its beats,
   so the section is fully laid out and ready for the files to drop in.
   --------------------------------------------------------------------- */
const CASES = [
{
  id:"asylum-backlog", cat:"immigration",
  head:"Maria has waited four years for a hearing that lasts one day",
  title:"End years-long waits for asylum hearings",
  caseName:"Ramirez v. U.S. Department of Homeland Security",
  ngo:"Open Door Legal Collective", defendant:"U.S. Department of Homeland Security",
  court:"U.S. District Court, N.D. California", judge:"Hon. R. Whitfield",
  goal:1850000, baseRaised:1244300, baseBackers:24180, watching:3182,
  vetted:"14 Feb 2026",
  hero:{src:"https://images.unsplash.com/photo-1589391886645-d51941baf7fb?auto=format&fit=crop&w=1400&q=70",
        credit:"Stock photograph — replace before launch"},
  trending:{reason:"+1,842 backers this week", kind:"backing", spark:[41,58,49,77,96,142,188]},
  beats:["Maria has waited four years for her asylum hearing.","Thousands of families are stuck in the same line.","The law requires a timely hearing. It isn't happening.","We're asking a federal court to enforce it.","Help fund the case that could clear the backlog."],
  merit:{base:34, baseNote:"Federal unreasonable-delay suits against DHS have won relief in 34% of the last 50 comparable filings.",
    factors:[
      {label:"Claim type", delta:6,  note:"Mandamus plus APA unreasonable delay. Courts have ordered a processing plan in 5 of the last 9 delay suits."},
      {label:"Jurisdiction", delta:9, note:"N.D. California has the most favourable delay-case record of any district for this claim."},
      {label:"Judge", delta:4, note:"Hon. R. Whitfield has granted relief in 3 of 5 prior agency-delay matters."},
      {label:"Attorney record", delta:7, note:"Lead counsel has certified three federal classes against federal agencies."},
      {label:"Defendant", delta:-8, note:"DHS litigates delay cases hard and appeals adverse rulings as a matter of course."},
      {label:"Evidence strength", delta:11, note:"Internal scheduling data obtained through FOIA shows the queue growing while staffing fell."},
      {label:"Supporting cases", delta:-5, note:"Two circuits split on whether the statutory deadline is judicially enforceable."}
    ]},
  impact:{factors:[
      {label:"People affected", weight:.28, score:92, note:"128,000 pending asylum claims fall inside the proposed class."},
      {label:"Severity of harm", weight:.24, score:78, note:"Years without work authorisation, family separation, no route to plan a life."},
      {label:"Lasting change", weight:.22, score:88, note:"A court-ordered processing plan would bind the agency for every future claimant."},
      {label:"Public attention", weight:.14, score:64, note:"Three national outlets covered the filing; sustained rather than spiking."},
      {label:"Community support", weight:.12, score:86, note:"24,180 backers and 41 partner organisations signed on."}
    ]},
  start:"Jan 2026", startYear:2026, stageIdx:1, stageMonths:[7,9,18,6,8,14],
  outcomes:{win:.21, settle:.37, lose:.42, awardMult:3.1, settleShare:.46,
            note:"A win here is mostly injunctive: the money back to backers comes from the fee award and the contingent share."},
  why:[
    {kind:"dots", value:23, of:100, label:"of claims wait over 4 years", note:"Up from 4 in 100 a decade ago."},
    {kind:"stat", value:"128,000", label:"people in the proposed class", note:"Every pending claim in the district."},
    {kind:"delta", value:"+412 days", label:"added to the average wait since 2022", note:"While staffing fell 11%."}
  ],
  clips:[
    {id:"a1", title:"Meet Maria", milestone:0, secs:58, src:null, beats:["Maria arrived in 2021.","She has a job offer she cannot take.","Her hearing is set for 2029.","One day in court. Four years to reach it."]},
    {id:"a2", title:"Why the line got longer", milestone:0, secs:47, src:null, beats:["The queue grew by 60,000.","Staffing fell by 11%.","Nobody was told.","We asked for the numbers anyway."]},
    {id:"a3", title:"What the FOIA showed", milestone:1, secs:63, src:null, beats:["900 pages arrived in March.","Page 214 has the scheduling model.","It projects a seven-year queue.","The agency has had it since 2023."]},
    {id:"a4", title:"Filing day", milestone:1, secs:41, src:null, beats:["Six plaintiffs. One complaint.","Filed 09:04 in San Francisco.","Forty-one organisations signed on.","Now the government answers."]},
    {id:"a5", title:"What we're asking the court for", milestone:2, secs:52, src:null, beats:["Not damages.","A schedule.","A plan the agency has to keep.","Checked by the court, not by us."]}
  ],
  people:{
    plaintiff:{name:"Maria R.", role:"Named plaintiff", bio:"Arrived in 2021 with her two children. Works nights when her permit allows it. Named in the caption at her own request, surname withheld by court order."},
    attorney:{name:"Ana Solís", role:"Lead counsel", bio:"18 years in federal immigration litigation. Certified three classes against federal agencies; argued twice before the Ninth Circuit.", stat:"3 federal classes certified"},
    firm:{name:"Open Door Legal Collective", kind:"Non-profit law office, founded 2009", bio:"Twenty-two staff attorneys across three offices. Takes no fee from clients; funds itself on statutory fee awards and grants.", stats:[["Cases brought","214"],["Relief obtained","61%"],["On LaunchJustice","7 cases"]]}
  },
  rating:{counts:[112, 186, 903, 4211, 9844]},
  summary:["Asylum seekers in the Bay Area are waiting four years or more for a first hearing, with no work authorisation for much of that time and no way to plan their lives.","This class action argues that the delay violates the government's own statutory deadlines, and asks the court to order a plan that processes pending cases inside a set timeframe."],
  budget:[["Attorney and paralegal time",920000],["Expert witnesses",380000],["Discovery and depositions",320000],["Court and filing costs",180000],["Class notice and outreach",50000]],
  timeline:[["Plaintiffs recruited and interviewed","Jan 2026",1],["FOIA production received","Mar 2026",1],["Complaint filed","Jun 2026",1],["Government response due","Oct 2026",0],["Class certification motion","Early 2027",0]],
  updates:[["Aug 2026","Two more families joined as named plaintiffs after the first clip went out to backers. The government asked for a 30-day extension, which we did not oppose."],
           ["Jul 2026","Forty-one organisations filed a joint statement of support. The full text is linked in the case file."]]
},
{
  id:"riverside-water", cat:"environment",
  head:"Riverside's tap water failed 11 safety tests. The permits were renewed anyway.",
  title:"Clean drinking water for Riverside Township",
  caseName:"Watershed Justice Project v. State Department of Environmental Quality",
  ngo:"Watershed Justice Project", defendant:"State Department of Environmental Quality",
  court:"State Superior Court", judge:"Not yet assigned",
  goal:920000, baseRaised:701500, baseBackers:15402, watching:1247,
  vetted:"3 Mar 2026",
  hero:{src:"https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1400&q=70",
        credit:"Stock photograph — replace before launch"},
  trending:{reason:"In the news — 3 outlets this week", kind:"news", spark:[22,26,31,28,64,88,96]},
  beats:["Riverside's tap water failed nitrate tests 11 times.","Parents buy bottled water for their babies.","The state knew and renewed the permits anyway.","We're taking the permits to court.","Back the case for clean water."],
  merit:{base:41, baseNote:"State permit challenges brought on a complete administrative record succeed about 41% of the time.",
    factors:[
      {label:"Claim type", delta:5, note:"Permit challenge under the state administrative procedure act, a route with settled standards."},
      {label:"Jurisdiction", delta:3, note:"Superior Court's environmental docket hears these on a compressed schedule."},
      {label:"Judge", delta:-2, note:"Not yet assigned. Two of the four judges on rotation have deferred to the agency in similar matters."},
      {label:"Attorney record", delta:8, note:"Counsel has won eleven clean-water permit challenges in this state."},
      {label:"Defendant", delta:-9, note:"State agencies receive substantial deference on technical findings."},
      {label:"Evidence strength", delta:14, note:"Eleven failed tests with documented chain of custody, plus the agency's own renewal memo."},
      {label:"Supporting cases", delta:6, note:"Two in-state rulings on point, both within the last four years."}
    ]},
  impact:{factors:[
      {label:"People affected", weight:.24, score:61, note:"11,400 residents on the affected water system."},
      {label:"Severity of harm", weight:.28, score:90, note:"Nitrate exposure at these levels is linked to infant methemoglobinemia."},
      {label:"Lasting change", weight:.20, score:74, note:"Enforceable discharge limits would apply to every upstream permit holder."},
      {label:"Public attention", weight:.14, score:58, note:"Regional coverage; one national environmental desk picked it up this week."},
      {label:"Community support", weight:.14, score:88, note:"The township board voted 6-1 to support the petition."}
    ]},
  start:"Mar 2026", startYear:2026, stageIdx:0, stageMonths:[9,8,15,5,7,12],
  outcomes:{win:.28, settle:.38, lose:.34, awardMult:2.6, settleShare:.52,
            note:"Most permit challenges that do not lose end in a consent decree with new monitoring conditions."},
  why:[
    {kind:"dots", value:11, of:12, label:"quarterly tests failed", note:"Every test but one since 2023."},
    {kind:"stat", value:"11,400", label:"residents on the system", note:"Including two schools and a clinic."},
    {kind:"delta", value:"3.4×", label:"the federal nitrate limit at peak", note:"Recorded in the August 2025 sample."}
  ],
  clips:[
    {id:"w1", title:"What comes out of the tap", milestone:0, secs:44, src:null, beats:["This is a glass from Ruth's kitchen.","It looks fine.","It tested at 34 milligrams per litre.","The limit is ten."]},
    {id:"w2", title:"The renewal memo", milestone:0, secs:57, src:null, beats:["We asked for the file.","Four hundred pages came back.","One memo matters.","It recommends renewal. It cites no new testing."]},
    {id:"w3", title:"Testing the creek ourselves", milestone:1, secs:61, src:null, beats:["Six sample points.","Eighteen months.","One independent lab.","The numbers rise downstream of the outfall."]},
    {id:"w4", title:"Ruth, who kept the receipts", milestone:1, secs:39, src:null, beats:["Ruth has bought bottled water since 2023.","She kept every receipt.","$4,180 so far.","She is 71."]}
  ],
  people:{
    plaintiff:{name:"Ruth Okafor", role:"Lead petitioner", bio:"Retired schoolteacher, Riverside resident for 34 years. Organised the door-to-door testing drive that produced the first independent samples."},
    attorney:{name:"Daniel Whitmore", role:"Lead counsel", bio:"Environmental litigator, 22 years. Eleven successful permit challenges in this state, two of which set the standard now cited in this petition.", stat:"11 permit challenges won"},
    firm:{name:"Watershed Justice Project", kind:"Non-profit, founded 2014", bio:"Nine lawyers and three hydrologists. Works only on drinking-water and discharge cases, and publishes every dataset it produces.", stats:[["Cases brought","68"],["Relief obtained","57%"],["On LaunchJustice","3 cases"]]}
  },
  rating:{counts:[64, 121, 588, 2914, 6102]},
  summary:["Residents of Riverside Township have received repeated notices that their tap water exceeds nitrate limits, while upstream discharge permits were renewed without new conditions.","The petition challenges those renewals and asks the court to require enforceable limits, independent monitoring and a remediation schedule."],
  budget:[["Water testing and hydrology experts",410000],["Attorney time",330000],["Community outreach and filings",120000],["Court costs",60000]],
  timeline:[["Independent water testing","Mar 2026",1],["Records requests completed","Jul 2026",1],["Petition drafted","Oct 2026",1],["Petition filed","Dec 2026",0],["Administrative record lodged","Early 2027",0]],
  updates:[["Sep 2026","The state produced the last of the withheld permit files after our second demand letter. Nothing in them changes the petition; two documents strengthen it."]]
},
{
  id:"maple-evictions", cat:"housing",
  head:"Forty families got eviction notices in the same week. No reason given.",
  title:"Stop no-cause evictions in Maple County",
  caseName:"Alvarez v. Northgate Property Management",
  ngo:"Tenant Defense Fund", defendant:"Northgate Property Management",
  court:"County Circuit Court", judge:"Hon. P. Nakamura",
  goal:640000, baseRaised:612900, baseBackers:31447, watching:5904,
  vetted:"21 Apr 2026",
  hero:{src:"https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1400&q=70",
        credit:"Stock photograph — replace before launch"},
  trending:{reason:"+4,106 backers this week", kind:"backing", spark:[88,104,96,167,245,388,411]},
  beats:["Forty families got eviction notices in one week.","No reason given. Rents doubled after.","Local law requires cause. We say it was ignored.","Tenants are fighting back together.","Stand with them in court."],
  merit:{base:47, baseNote:"Just-cause ordinance suits with documented simultaneous notices prevail in roughly 47% of comparable county filings.",
    factors:[
      {label:"Claim type", delta:8, note:"Direct violation of a county ordinance with a private right of action and fee shifting."},
      {label:"Jurisdiction", delta:6, note:"Maple County has enforced the ordinance twice since it passed."},
      {label:"Judge", delta:-3, note:"Hon. P. Nakamura has split on tenant injunctions: two granted, three denied."},
      {label:"Attorney record", delta:5, note:"Counsel has defended more than 200 evictions in this courthouse."},
      {label:"Defendant", delta:7, note:"A private management company with a thin appeal budget and an insurer that prefers to settle."},
      {label:"Evidence strength", delta:9, note:"Forty notices, near-identical text, all dated within six days of the sale closing."},
      {label:"Supporting cases", delta:4, note:"Two county rulings directly on the notice-timing question."},
      {label:"Merits", delta:-6, note:"The ordinance has a substantial-renovation exception the defence has already invoked."}
    ]},
  impact:{factors:[
      {label:"People affected", weight:.22, score:54, note:"40 households, 112 people, 31 of them children."},
      {label:"Severity of harm", weight:.26, score:84, note:"Displacement into a market with a 1.1% vacancy rate."},
      {label:"Lasting change", weight:.22, score:70, note:"A ruling would settle how the renovation exception is read countywide."},
      {label:"Public attention", weight:.16, score:72, note:"Local television covered the first hearing; the clip has 2.1M views on the platform."},
      {label:"Community support", weight:.14, score:94, note:"31,447 backers, the highest count on the platform this quarter."}
    ]},
  start:"Apr 2026", startYear:2026, stageIdx:2, stageMonths:[4,6,11,4,5,10],
  outcomes:{win:.31, settle:.46, lose:.23, awardMult:2.9, settleShare:.58,
            note:"Fee shifting under the ordinance is what makes a backer return realistic here."},
  why:[
    {kind:"dots", value:40, of:52, label:"of the 52 units got a notice", note:"All within six days of the sale closing."},
    {kind:"stat", value:"112 people", label:"facing displacement", note:"31 of them children under 12."},
    {kind:"delta", value:"+94%", label:"rent on the relisted units", note:"$1,450 to $2,815 a month."}
  ],
  clips:[
    {id:"m1", title:"The week the notices came", milestone:0, secs:22, src:null, beats:["Tuesday: eleven notices.","Wednesday: nineteen.","Friday: ten more.","Same wording. Same printer."]},
    {id:"m2", title:"Building a tenant association in nine days", milestone:0, secs:22, src:null, beats:["Forty doors.","Four languages.","One meeting in a laundry room.","Thirty-eight families signed on."]},
    {id:"m3", title:"Inside the first hearing", milestone:1, secs:22, src:null, beats:["The courtroom held sixty.","A hundred and ten came.","The judge moved us to the big room.","Nobody left early."]},
    {id:"m4", title:"What discovery turned up", milestone:2, secs:22, src:null, beats:["We asked for the renovation permits.","There are four.","There are forty units.","That is the case."]},
    {id:"m5", title:"Rosa, 31 years in 4B", milestone:2, secs:22, src:null, beats:["Rosa moved in in 1995.","She raised two children in 4B.","Her notice gave her sixty days.","She is still there."]}
  ],
  people:{
    plaintiff:{name:"Rosa Alvarez", role:"Named plaintiff", bio:"Has lived in the same two-bedroom for 31 years and raised two children there. Convened the first tenant meeting in the building's laundry room."},
    attorney:{name:"Marcus Bell", role:"Lead counsel", bio:"Housing litigator, 14 years. Has defended more than 200 evictions in this courthouse and helped draft the county's just-cause ordinance.", stat:"200+ evictions defended"},
    firm:{name:"Tenant Defense Fund", kind:"Non-profit legal aid, founded 2016", bio:"Sixteen attorneys and a tenant-organiser team. Operates the county's only same-day eviction hotline.", stats:[["Cases brought","1,204"],["Relief obtained","68%"],["On LaunchJustice","11 cases"]]}
  },
  rating:{counts:[141, 208, 1102, 6884, 18902]},
  summary:["Tenants across three buildings received simultaneous no-cause notices shortly after the buildings changed hands. Units were relisted at nearly double the rent.","The suit argues the notices violate the county's just-cause ordinance, seeks to void them, and asks for the fee award the ordinance provides."],
  budget:[["Attorney time",340000],["Tenant organising and translation",140000],["Expert on renovation-permit practice",90000],["Court costs",70000]],
  timeline:[["Tenant association formed","Apr 2026",1],["Complaint filed","Jul 2026",1],["Injunction hearing held","Oct 2026",1],["Discovery","Ongoing",0],["Trial date","Late 2027",0]],
  updates:[["Sep 2026","The court paused all forty evictions pending trial. Nobody in the three buildings has to move while the case runs."],
           ["Aug 2026","Discovery produced four renovation permits covering forty units. We have moved for partial summary judgment."]]
},
{
  id:"farmworker-wages", cat:"labor",
  head:"They picked for ten hours. They were paid for seven.",
  title:"Recover unpaid wages for farmworkers",
  caseName:"Ortiz v. Valley Harvest Contracting LLC",
  ngo:"Field Workers Alliance", defendant:"Valley Harvest Contracting LLC",
  court:"U.S. District Court, E.D. Washington", judge:"Hon. L. Brennan",
  goal:1240000, baseRaised:388200, baseBackers:9116, watching:764,
  vetted:"9 Nov 2025",
  hero:{src:"https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1400&q=70",
        credit:"Stock photograph — replace before launch"},
  trending:null,
  beats:["Ten-hour days. Paid for seven.","Over 300 workers, three harvest seasons.","Their pay stubs tell the story.","Now a court will hear it.","Help them get what they earned."],
  merit:{base:44, baseNote:"Wage-and-hour collective actions with partial payroll records resolve in the workers' favour about 44% of the time.",
    factors:[
      {label:"Claim type", delta:7, note:"FLSA plus state wage law, with liquidated damages available on both."},
      {label:"Jurisdiction", delta:2, note:"E.D. Washington handles agricultural wage cases regularly and moves them briskly."},
      {label:"Judge", delta:5, note:"Hon. L. Brennan has certified four of six wage collectives that came before her."},
      {label:"Attorney record", delta:-4, note:"First federal collective action for this firm, though co-counsel has run nine."},
      {label:"Defendant", delta:-9, note:"A contracting LLC with thin assets. Collecting a judgment is a live risk."},
      {label:"Evidence strength", delta:-3, note:"Payroll records are incomplete for 2023 and have been reconstructed from worker logs."},
      {label:"Supporting cases", delta:9, note:"Ninth Circuit precedent on automatic break deductions is squarely on point."}
    ]},
  impact:{factors:[
      {label:"People affected", weight:.26, score:67, note:"312 workers across three harvest seasons."},
      {label:"Severity of harm", weight:.26, score:81, note:"An average of $6,400 in unpaid wages per worker, owed to people earning near minimum."},
      {label:"Lasting change", weight:.20, score:66, note:"A ruling would reach the eleven other growers using the same timekeeping vendor."},
      {label:"Public attention", weight:.14, score:41, note:"Trade press only. No general-audience coverage yet."},
      {label:"Community support", weight:.14, score:72, note:"9,116 backers and two farmworker unions."}
    ]},
  start:"Nov 2025", startYear:2025, stageIdx:2, stageMonths:[5,7,20,6,8,13],
  outcomes:{win:.19, settle:.32, lose:.49, awardMult:3.4, settleShare:.41,
            note:"Collectability is the risk here, not the merits. A judgment the defendant cannot pay returns nothing."},
  why:[
    {kind:"dots", value:3, of:10, label:"of each shift went unpaid", note:"Three hours in ten, on the workers' own logs."},
    {kind:"stat", value:"$6,400", label:"owed to the average worker", note:"Before liquidated damages."},
    {kind:"delta", value:"312", label:"workers in the collective", note:"Across three harvest seasons."}
  ],
  clips:[
    {id:"f1", title:"What a pay stub hides", milestone:0, secs:51, src:null, beats:["This stub says seven hours.","The field log says ten.","The bus left at 5:40am.","It came back at 6:20pm."]},
    {id:"f2", title:"The timekeeping system", milestone:1, secs:63, src:null, beats:["Breaks were deducted automatically.","Whether or not they were taken.","Eleven other growers use it.","The manual is exhibit four."]},
    {id:"f3", title:"Why 2023 is missing", milestone:2, secs:47, src:null, beats:["We asked for three seasons.","Two arrived.","2023 is 'unavailable'.","So we rebuilt it from the workers' notebooks."]},
    {id:"f4", title:"Esteban keeps notebooks", milestone:2, secs:55, src:null, beats:["Esteban writes down his hours.","Every day since 2019.","Four notebooks.","They match each other exactly."]}
  ],
  people:{
    plaintiff:{name:"Esteban Ortiz", role:"Named plaintiff", bio:"Has worked the valley harvest for seven seasons. Kept a daily record of his hours in pocket notebooks since 2019, which became the backbone of the reconstructed payroll."},
    attorney:{name:"Priya Raghunathan", role:"Lead counsel", bio:"Employment lawyer, 9 years, first chair on her first federal collective action. Co-counsel with a firm that has run nine.", stat:"1st federal collective, 9 with co-counsel"},
    firm:{name:"Field Workers Alliance", kind:"Non-profit, founded 2011", bio:"Six lawyers and eleven bilingual field organisers. Runs wage clinics at eight labour camps during harvest.", stats:[["Cases brought","94"],["Relief obtained","52%"],["On LaunchJustice","2 cases"]]}
  },
  rating:{counts:[88, 164, 612, 1988, 3402]},
  summary:["Seasonal workers report being paid for fewer hours than they worked, with breaks deducted that were never taken.","The case seeks back wages, liquidated damages and a ruling on the automatic-deduction practice that reaches the other growers using the same system."],
  budget:[["Attorney time",640000],["Payroll forensic accountant",300000],["Depositions and interpreters",210000],["Court and notice costs",90000]],
  timeline:[["Complaint filed","Nov 2025",1],["Motion to dismiss denied","Mar 2026",1],["Collective conditionally certified","Jun 2026",1],["Discovery","Ongoing",0],["Trial date","2027",0]],
  updates:[["Aug 2026","The court conditionally certified the collective. Notice goes out to 312 workers in three languages this month."]]
},
{
  id:"transit-access", cat:"disability",
  head:"The ramp is broken again, and Deshawn is late to dialysis",
  title:"Accessible buses for wheelchair users",
  caseName:"Equal Route Coalition v. Metro Regional Transit Authority",
  ngo:"Equal Route Coalition", defendant:"Metro Regional Transit Authority",
  court:"U.S. District Court", judge:"Hon. A. Ferrell",
  goal:780000, baseRaised:733800, baseBackers:19655, watching:2088,
  vetted:"18 Sep 2025",
  hero:{src:"https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1400&q=70",
        credit:"Stock photograph — replace before launch"},
  trending:{reason:"Settlement talks — 1,204 joined this week", kind:"talk", spark:[54,61,58,72,110,164,186]},
  beats:["The ramp is broken again.","Riders wait for a second bus. Then a third.","One in five ramps failed inspection.","The law says transit must be accessible.","Fund the fix."],
  merit:{base:52, baseNote:"ADA Title II transit cases with a documented failure log settle or win about 52% of the time.",
    factors:[
      {label:"Claim type", delta:7, note:"ADA Title II, the clearest statutory route for a public transit accessibility claim."},
      {label:"Jurisdiction", delta:3, note:"This district has entered two transit consent decrees in the last decade."},
      {label:"Judge", delta:2, note:"Hon. A. Ferrell has approved every accessibility consent decree put in front of her."},
      {label:"Attorney record", delta:6, note:"Counsel negotiated four transit consent decrees, three of which are still being monitored."},
      {label:"Defendant", delta:4, note:"A public authority with a board that has twice chosen to settle rather than try an accessibility case."},
      {label:"Evidence strength", delta:10, note:"Fourteen months of the authority's own ramp-failure logs, obtained in discovery."},
      {label:"Supporting cases", delta:3, note:"Two consent decrees on closely comparable facts."},
      {label:"Merits", delta:-7, note:"The remedy is operational. Courts are reluctant to supervise a maintenance schedule."},
      {label:"Relief available", delta:-4, note:"Injunctive relief only. No damages, which limits the pool a backer return comes from."}
    ]},
  impact:{factors:[
      {label:"People affected", weight:.26, score:76, note:"4,900 registered wheelchair users on the network, plus every future rider."},
      {label:"Severity of harm", weight:.22, score:69, note:"Missed dialysis, missed shifts, missed hearings. Measured in the rider survey."},
      {label:"Lasting change", weight:.24, score:85, note:"A monitored maintenance plan lasts as long as the decree, typically five years."},
      {label:"Public attention", weight:.14, score:52, note:"Steady local coverage; the ramp-failure log made the front page once."},
      {label:"Community support", weight:.14, score:80, note:"19,655 backers and the regional disability rights council."}
    ]},
  start:"Sep 2025", startYear:2025, stageIdx:3, stageMonths:[5,6,14,4,6,11],
  outcomes:{win:.18, settle:.58, lose:.24, awardMult:2.4, settleShare:.62,
            note:"This case is in settlement talks. The realistic path is a consent decree with a fee award, not a trial verdict."},
  why:[
    {kind:"dots", value:21, of:100, label:"of ramps failed inspection", note:"In the authority's own audit."},
    {kind:"stat", value:"4,900", label:"registered wheelchair riders", note:"On a network of 61 routes."},
    {kind:"delta", value:"38 min", label:"average extra wait after a failure", note:"Two buses passed, on average, before one worked."}
  ],
  clips:[
    {id:"t1", title:"Deshawn's Tuesday", milestone:0, secs:57, src:null, beats:["Dialysis at nine.","The 7:40 ramp jams.","So does the 7:55.","He arrives at 9:40. Again."]},
    {id:"t2", title:"What the inspection found", milestone:1, secs:43, src:null, beats:["The authority audits its own ramps.","One in five failed.","The audit was never published.","We asked for it in discovery."]},
    {id:"t3", title:"Fourteen months of logs", milestone:2, secs:61, src:null, beats:["Every failure gets a ticket.","There are 2,840 tickets.","The median fix took nine days.","The contract says two."]},
    {id:"t4", title:"What a consent decree looks like", milestone:3, secs:66, src:null, beats:["Not a cheque.","A maintenance schedule.","An independent monitor.","Five years of reporting."]},
    {id:"t5", title:"Inside mediation", milestone:3, secs:48, src:null, beats:["Four sessions so far.","The authority has moved twice.","The sticking point is the monitor.","We are not dropping it."]}
  ],
  people:{
    plaintiff:{name:"Deshawn Miller", role:"Named plaintiff", bio:"Uses the network three times a week for dialysis. Logged every ramp failure he encountered for eleven months, which is how the case started."},
    attorney:{name:"Claire Donnelly", role:"Lead counsel", bio:"Disability rights litigator, 26 years. Negotiated four transit consent decrees and monitors three of them.", stat:"4 transit consent decrees"},
    firm:{name:"Equal Route Coalition", kind:"Non-profit, founded 2004", bio:"Eleven staff and a rider advisory board of forty. Publishes an annual accessibility scorecard for every transit system in the state.", stats:[["Cases brought","131"],["Relief obtained","74%"],["On LaunchJustice","5 cases"]]}
  },
  rating:{counts:[72, 118, 704, 3811, 8206]},
  summary:["Wheelchair users are routinely passed by buses with broken ramps or lifts, making trips to work, dialysis and medical appointments unreliable.","The case seeks a maintenance plan, repair deadlines and independent monitoring under the ADA. It is now in court-supervised mediation."],
  budget:[["Attorney time",400000],["Accessibility audit and expert",200000],["Monitoring during settlement",110000],["Court costs",70000]],
  timeline:[["Complaint filed","Sep 2025",1],["Ramp-failure logs produced","Feb 2026",1],["Mediation begun","May 2026",1],["Settlement terms","Fall 2026",0],["Decree entered and monitored","2027",0]],
  updates:[["Sep 2026","Fourth mediation session held. The authority has agreed to publish repair times monthly. The independent monitor is still open."]]
},
{
  id:"school-facial-rec", cat:"privacy",
  head:"Every student's face, scanned every morning. Nobody asked the parents.",
  title:"No facial recognition in public schools",
  caseName:"Student Privacy Watch v. Lakeview Unified School District",
  ngo:"Student Privacy Watch", defendant:"Lakeview Unified School District",
  court:"State Superior Court", judge:"Not yet assigned",
  goal:520000, baseRaised:121400, baseBackers:6208, watching:1416,
  vetted:"2 Aug 2026",
  hero:{src:"https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1400&q=70",
        credit:"Stock photograph — replace before launch"},
  trending:{reason:"In the news — district paused rollout", kind:"news", spark:[8,11,9,14,52,74,81]},
  beats:["Every student's face, scanned every morning.","Parents were never asked.","Nobody knows who sees the data.","We think state privacy law was broken.","Help us find out in court."],
  merit:{base:31, baseNote:"First-of-kind biometric privacy claims against public bodies succeed about 31% of the time.",
    factors:[
      {label:"Claim type", delta:4, note:"State biometric privacy statute with a private right of action, but never applied to a school district."},
      {label:"Jurisdiction", delta:2, note:"Superior Court, no specialised docket, ordinary civil schedule."},
      {label:"Judge", delta:-2, note:"Not yet assigned."},
      {label:"Attorney record", delta:6, note:"Counsel has brought seven biometric privacy claims, five of them successfully."},
      {label:"Defendant", delta:-8, note:"A public school district with a governmental immunity defence already pleaded."},
      {label:"Evidence strength", delta:9, note:"The vendor contract and data-retention schedule arrived intact through a records request."},
      {label:"Supporting cases", delta:-7, note:"No controlling precedent in this state. Every persuasive case comes from elsewhere."},
      {label:"Public attention", delta:4, note:"The district paused the rollout the week after coverage started, which helps on the equities."}
    ]},
  impact:{factors:[
      {label:"People affected", weight:.24, score:88, note:"14,200 students enrolled, plus every district watching the outcome."},
      {label:"Severity of harm", weight:.22, score:62, note:"No breach yet. The harm is the record itself and where it can travel."},
      {label:"Lasting change", weight:.26, score:91, note:"The first ruling in this state on biometrics in schools would govern all 940 districts."},
      {label:"Public attention", weight:.16, score:77, note:"National technology press; two state legislators cited the case in a bill hearing."},
      {label:"Community support", weight:.12, score:69, note:"6,208 backers and the district's own parent-teacher council."}
    ]},
  start:"Aug 2026", startYear:2026, stageIdx:0, stageMonths:[10,8,16,5,7,13],
  outcomes:{win:.16, settle:.23, lose:.61, awardMult:3.8, settleShare:.38,
            note:"A long-odds, high-consequence case. It is on the platform because the precedent matters, not because the odds are good."},
  why:[
    {kind:"stat", value:"14,200", label:"students scanned every morning", note:"Two doors, matched against a roster."},
    {kind:"dots", value:0, of:100, label:"of families were asked for consent", note:"The board vote was listed as a facilities upgrade."},
    {kind:"delta", value:"7 years", label:"the vendor may keep the data", note:"Per the contract we obtained."}
  ],
  clips:[
    {id:"p1", title:"What the camera sees", milestone:0, secs:46, src:null, beats:["Two cameras. One door.","Every face, every morning.","Matched against a roster.","And kept."]},
    {id:"p2", title:"The contract, page 9", milestone:0, secs:54, src:null, beats:["We asked for the vendor contract.","It came back unredacted.","Page nine is the retention schedule.","Seven years."]},
    {id:"p3", title:"What the board voted on", milestone:0, secs:49, src:null, beats:["The agenda said 'facilities upgrade'.","The minutes are four lines.","No parent spoke.","Nobody knew to."]},
    {id:"p4", title:"Why there's no precedent", milestone:1, secs:62, src:null, beats:["The statute is six years old.","It has never met a school district.","Somebody has to be first.","That is what this case is."]}
  ],
  people:{
    plaintiff:{name:"The Nakamura family", role:"Named plaintiffs", bio:"Two parents of a ninth-grader who learned about the scanning from their child, not the district. They asked to be named so other families would come forward."},
    attorney:{name:"Owen Aduba", role:"Lead counsel", bio:"Privacy litigator, 11 years. Seven biometric privacy claims brought, five resolved in his clients' favour. Teaches a seminar on the statute at issue.", stat:"7 biometric claims, 5 won"},
    firm:{name:"Student Privacy Watch", kind:"Non-profit, founded 2018", bio:"Four lawyers and two technologists. Audits school technology contracts across the state and publishes what it finds.", stats:[["Cases brought","23"],["Relief obtained","48%"],["On LaunchJustice","1 case"]]}
  },
  rating:{counts:[102, 178, 588, 1642, 2604]},
  summary:["The district installed face-scanning cameras at school entrances without a public vote or parental consent, under a contract that lets the vendor keep the records for seven years.","The planned suit asks the court to halt the programme and order deletion of everything collected."],
  budget:[["Attorney time",300000],["Technical expert and audit",140000],["Filing, records and notice",80000]],
  timeline:[["Records requests sent","Aug 2026",1],["Vendor contract obtained","Sep 2026",1],["Demand letter sent","Nov 2026",0],["Petition filed","Feb 2027",0]],
  updates:[["Sep 2026","The district paused new enrolment into the programme but has not switched off the cameras or deleted anything."]]
}
];

/* ---------------------------------------------------------------------
   Derived scores
   A case never stores its own score. Chance to win is the base rate plus
   every factor delta; social impact is the weighted mean of its factors.
   Both are clamped to 1..99 because neither a model nor a lawyer should
   ever show a client 0% or 100%.
   --------------------------------------------------------------------- */
const clamp = (n,lo,hi) => Math.max(lo, Math.min(hi, n));
const meritScore  = c => clamp(Math.round(c.merit.base + c.merit.factors.reduce((s,f)=>s+f.delta,0)), 1, 99);
const impactScore = c => clamp(Math.round(c.impact.factors.reduce((s,f)=>s+f.weight*f.score,0)), 1, 99);

/* Lock-in: the stage durations are the schedule, so the timeline visual and
   the lock-in figure can never drift apart. */
const totalMonths = c => c.stageMonths.reduce((a,b)=>a+b,0);
const lockYears   = c => Math.round(totalMonths(c)/12*10)/10;
const endYear     = c => c.startYear + Math.ceil(totalMonths(c)/12);
const monthsDone  = c => c.stageMonths.slice(0, c.stageIdx).reduce((a,b)=>a+b,0) + c.stageMonths[c.stageIdx]*0.5;

/* What a pledge is worth in each outcome.
   Of every dollar pledged, ~3% goes to payment processing and the rest works
   the case. On a win the backers' pool is 41% of the award, split in
   proportion to what each person put in. */
function outcomeFor(c, amount){
  const o = c.outcomes;
  const award = c.goal * o.awardMult;
  const share = amount / c.goal;                    /* this backer's share of the raise */
  const win   = award * SPLIT.backers * share;
  return {
    win:    Math.round(win),
    settle: Math.round(win * o.settleShare),
    lose:   0,
    p: {win:o.win, settle:o.settle, lose:o.lose},
    award, note:o.note
  };
}

/* ---------------------------------------------------------------------
   Seeded discussion
   n name, s stance (support | question | skeptical), b backer, h hours ago,
   l likes, t text, r replies. A reply with role: set is the legal team, and
   is drawn with the firm's badge.
   These are fictional people writing about fictional cases.
   --------------------------------------------------------------------- */
const SEED_COMMENTS = {
"asylum-backlog":[
 {n:"Priya Raman", s:"support", b:true, h:3, l:2841, t:"I work at a clinic two blocks from the immigration court. We see the four-year wait as a medical problem before it is a legal one: people stop treating chronic conditions because they cannot plan past next month. Backed at $250.",
  r:[{n:"Ana Solís", role:"Lead counsel, Open Door Legal Collective", h:2, t:"Thank you, and this is useful beyond the encouragement. If your clinic can document the pattern in aggregate, that is exactly the kind of declaration the court reads closely on irreparable harm. Our intake address is in the case file."}]},
 {n:"Daniel Okonkwo", s:"question", b:false, h:6, l:612, t:"Genuine question: if the court orders a schedule and the agency just misses it, what happens? Does this end up back in front of the same judge in 2031?",
  r:[{n:"Ana Solís", role:"Lead counsel, Open Door Legal Collective", h:5, t:"Fair question and the honest answer is: sometimes yes. What a court order changes is the cost of missing. We are asking for quarterly reporting to the court, which is what made the difference in the two comparable cases that held. Enforcement is slow, but it is not nothing."}]},
 {n:"Hana Yoshida", s:"support", b:true, h:9, l:1204, t:"The FOIA detail in clip three is the part that convinced me. The agency has had its own projection of a seven-year queue since 2023. That is not a resourcing accident, it is a decision nobody wrote down."},
 {n:"Marcus Feld", s:"skeptical", b:false, h:12, l:498, t:"I want this to win and I still think 58% is generous. Two circuits are split, DHS appeals everything, and the remedy is exactly the kind of structural injunction the current Supreme Court has been trimming. I would put it closer to 40.",
  r:[{n:"Ana Solís", role:"Lead counsel, Open Door Legal Collective", h:11, t:"That is a reasonable read and close to our internal downside case. The score you see is the platform's model, not ours; we would not have filed if we thought 40 was the ceiling, but we would not call you wrong either. The circuit split is the single biggest risk in the case."},
     {n:"Marcus Feld", h:10, t:"Appreciate the straight answer. Backed at $100 on the strength of it."}]},
 {n:"Sofia Duarte", s:"support", b:true, h:16, l:934, t:"My mother waited three years in the nineties and it was considered a scandal then. Four years is now the median. Somewhere along the way we stopped being shocked."},
 {n:"Theo Lindqvist", s:"question", b:true, h:21, l:377, t:"How does the class definition handle people whose claims get decided while the case is pending? Do they drop out?",
  r:[{n:"Ana Solís", role:"Lead counsel, Open Door Legal Collective", h:20, t:"They stay in for the relief already sought, which is why we defined the class by filing date rather than by pending status. Otherwise the agency could pick off named plaintiffs by scheduling them, which has happened in two prior delay cases."}]},
 {n:"Amara Blake", s:"support", b:false, h:28, l:566, t:"The thing I keep coming back to is that the fix is administrative. Nobody is asking the court to rewrite asylum law. They are asking it to make the agency say when."},
 {n:"Ben Sorensen", s:"skeptical", b:false, h:34, l:288, t:"Four-year lock-in on a case where the upside is mostly injunctive. I support the cause but I want people going in with clear eyes about the return, which looks thin next to the housing case."},
 {n:"Grace Mbeki", s:"support", b:true, h:41, l:702, t:"Forty-one partner organisations signing the joint statement is the number I would put on the banner. That is a coalition, not a lawsuit."},
 {n:"Jonah Reiss", s:"question", b:false, h:52, l:194, t:"Is there any risk that winning this speeds up denials rather than approvals? A faster queue is not automatically a kinder one."},
 {n:"Lucia Ferrante", s:"support", b:true, h:63, l:845, t:"Watched the Maria clip on the train and pledged before I got off. The line about one day in court taking four years to reach has been in my head all week."}
],
"riverside-water":[
 {n:"Ruth Okafor", s:"support", b:true, h:2, l:1988, t:"Petitioner here. I did not expect to be reading comments from fifteen thousand people about my tap water. Thank you. The receipts are in a shoebox if anyone doubts the $4,180.",
  r:[{n:"Daniel Whitmore", role:"Lead counsel, Watershed Justice Project", h:1, t:"The shoebox is now exhibit 11, for the record."}]},
 {n:"Karl Jensen", s:"question", b:false, h:5, l:534, t:"If the court sends the permits back for reconsideration, what stops the agency from renewing them again with slightly better paperwork?",
  r:[{n:"Daniel Whitmore", role:"Lead counsel, Watershed Justice Project", h:4, t:"Nothing, on remand alone. That is why the petition asks for enforceable numeric limits rather than a fresh process. A remand without conditions is the outcome we are working hardest to avoid, and it is the most likely way this ends up a partial win."}]},
 {n:"Ines Cardoso", s:"support", b:true, h:8, l:1102, t:"Hydrologist, not affiliated. I looked at the published sample set because this project publishes everything, which is rarer than it should be. The downstream gradient is clean and the chain of custody is documented properly. This is good work."},
 {n:"Tom Whelan", s:"skeptical", b:false, h:14, l:421, t:"State agencies get enormous deference on technical findings. The evidence looks strong but I have watched three of these get waved through on the standard of review alone."},
 {n:"Naomi Adeyemi", s:"support", b:true, h:19, l:688, t:"Two schools and a clinic on the same system is the detail that moved me from interested to backing."},
 {n:"Felix Braun", s:"question", b:true, h:26, l:302, t:"Does a consent decree here produce any return for backers, or is it purely injunctive like the transit case?",
  r:[{n:"Daniel Whitmore", role:"Lead counsel, Watershed Justice Project", h:25, t:"There is a fee-shifting provision in the state statute, so a consent decree typically carries a fee award. That is the pool the backer share comes from. It is real but it is smaller than a damages case, and the returns panel on this page models it that way."}]},
 {n:"Sandra Villalobos", s:"support", b:false, h:33, l:459, t:"The renewal memo citing no new testing is the whole case in one sentence. Someone signed that."},
 {n:"Peter Nyholm", s:"skeptical", b:false, h:45, l:210, t:"Judge not yet assigned is doing a lot of work in that score. Two of the four on rotation would sink this."},
 {n:"Gita Malhotra", s:"support", b:true, h:58, l:571, t:"Bought bottled water for my parents' house for two years in a different state. Nobody sues over it because nobody can afford to. That is what this platform is for."}
],
"maple-evictions":[
 {n:"Rosa Alvarez", s:"support", b:true, h:1, l:6204, t:"Thirty-one years in 4B. When the notice came I thought that was the end of it, because that is how it has always gone here. Then thirty-eight neighbours signed. Whatever happens in court, that part already happened.",
  r:[{n:"Marcus Bell", role:"Lead counsel, Tenant Defense Fund", h:1, t:"And to be precise about the legal significance of that: a single tenant contesting a notice is a hard case. Forty tenants with identical notices is a pattern, and a pattern is what the ordinance was written for."}]},
 {n:"Wei Chen", s:"support", b:true, h:3, l:3411, t:"Four renovation permits for forty units. I have read that line six times and it still does me in. Backed at $500."},
 {n:"Oliver Hart", s:"question", b:false, h:7, l:822, t:"The renovation exception is the obvious defence. How strong is it actually? The breakdown gives it -6 but does not say why it is not worse.",
  r:[{n:"Marcus Bell", role:"Lead counsel, Tenant Defense Fund", h:6, t:"Because the exception requires the work to be substantial and to make the unit uninhabitable during it. They pulled four permits, all for kitchen fixtures. We deposed their contractor in August. I will not say more than that here, but the -6 is where I would put it too."}]},
 {n:"Yusuf Demir", s:"support", b:true, h:11, l:1644, t:"The laundry-room meeting clip is the best thing on this platform. Four languages, one folding table, and a county ordinance nobody had read since it passed."},
 {n:"Helen Ashcroft", s:"skeptical", b:false, h:15, l:604, t:"Highest score on the site and it is a small-stakes county case against a landlord with an insurer. I would rather the money went to the asylum case, which affects a hundred thousand people. High odds and low impact is still low impact.",
  r:[{n:"Marcus Bell", role:"Lead counsel, Tenant Defense Fund", h:14, t:"That is a completely legitimate way to allocate, and the impact score says roughly what you are saying: 74 against 83. What I would add is that the ruling reaches the renovation exception countywide, so the forty households are the plaintiffs, not the whole effect."},
     {n:"Helen Ashcroft", h:13, t:"That is a better answer than I expected. Split it, then. Half here."}]},
 {n:"André Lemoine", s:"support", b:true, h:18, l:1201, t:"The evictions are paused for everyone in all three buildings while this runs. That already happened. Whatever the verdict, nobody has spent this winter in a car."},
 {n:"Sinead Gallagher", s:"question", b:true, h:24, l:388, t:"If they settle, do the tenants get to stay, or do they get money and move?",
  r:[{n:"Marcus Bell", role:"Lead counsel, Tenant Defense Fund", h:23, t:"The tenant association voted on that in June and the answer was tenancy first, money second. We are not authorised to trade the leases for a cheque and would not ask to be."}]},
 {n:"Bram de Vries", s:"support", b:false, h:31, l:733, t:"1.1% vacancy rate. There is nowhere for these families to go. That statistic should be next to the headline."},
 {n:"Nadia Haddad", s:"support", b:true, h:38, l:512, t:"Backed six cases on here. This is the first one where I have watched every clip twice."},
 {n:"Colin Pryce", s:"skeptical", b:false, h:44, l:266, t:"A 77 looks high to me for a judge who has denied three of five tenant injunctions. That factor should be heavier than -3."},
 {n:"Fatima Nasser", s:"support", b:true, h:51, l:894, t:"Rosa raised two children in that apartment. Northgate has owned it for eleven months."},
 {n:"Jae-won Park", s:"question", b:false, h:66, l:301, t:"How is the fee award split if it comes in higher than the funding goal? Does the surplus go back to backers proportionally or is it capped?"}
],
"farmworker-wages":[
 {n:"Esteban Ortiz", s:"support", b:true, h:4, l:1442, t:"I wrote my hours down because my father told me to. He was a picker too. I did not know it would matter like this.",
  r:[{n:"Priya Raghunathan", role:"Lead counsel, Field Workers Alliance", h:3, t:"Four notebooks, seven seasons, and they reconcile with each other to the minute. Our forensic accountant said it was the cleanest reconstructed record she had worked from."}]},
 {n:"Linda Stroud", s:"question", b:false, h:9, l:588, t:"The collectability warning is right there in the returns panel, which I appreciate. But if the LLC is thin, what is the actual plan? Is there a parent company?",
  r:[{n:"Priya Raghunathan", role:"Lead counsel, Field Workers Alliance", h:8, t:"We have pleaded joint employment against two growers who used the contractor, which is the realistic route to a collectable judgment. That theory is not certain, and if it fails the recovery shrinks a lot. It is the main reason this case scores 51 and not higher."}]},
 {n:"Hugo Marchetti", s:"support", b:true, h:13, l:702, t:"The automatic break deduction is used by eleven other growers. Winning this fixes eleven payrolls, not one."},
 {n:"Carla Mendes", s:"skeptical", b:false, h:20, l:344, t:"Lowest funded case with the longest timeline and the thinnest defendant. I understand why it is slow to fund and I do not think the model is wrong about it."},
 {n:"Ade Fashola", s:"support", b:true, h:27, l:466, t:"$6,400 each. For people earning near minimum that is a car, a deposit, a year of stability. It is not an abstraction."},
 {n:"Trine Halvorsen", s:"question", b:true, h:35, l:212, t:"Why is 2023 payroll unavailable? Is there a spoliation argument if they destroyed it?",
  r:[{n:"Priya Raghunathan", role:"Lead counsel, Field Workers Alliance", h:34, t:"We have raised it. The answer we got was a vendor migration. Whether that earns an adverse inference is a question for the judge and we have briefed it, but we built the case so that we win it without needing the inference."}]},
 {n:"Samuel Nkemelu", s:"support", b:false, h:49, l:377, t:"Notice going out in three languages to 312 workers is the update that made me back this. Most of them do not know yet that they are owed anything."},
 {n:"Paulina Zielinska", s:"support", b:true, h:62, l:298, t:"Trade press only, no general coverage. Sometimes the cases that get no attention are the ones that need the funding most."}
],
"transit-access":[
 {n:"Deshawn Miller", s:"support", b:true, h:2, l:3188, t:"Eleven months of logging every broken ramp on my phone felt pointless while I was doing it. It is now fourteen months of the authority's own records plus mine. Keep your receipts, everyone.",
  r:[{n:"Claire Donnelly", role:"Lead counsel, Equal Route Coalition", h:2, t:"His log is what let us ask for theirs with enough specificity that they could not narrow the request. The case exists because one rider was stubborn with a notes app."}]},
 {n:"Miriam Voss", s:"question", b:false, h:6, l:744, t:"You are in mediation and the score is 76, but the returns panel says injunctive relief only. What does a backer actually get if this settles well?",
  r:[{n:"Claire Donnelly", role:"Lead counsel, Equal Route Coalition", h:5, t:"A fee award under the ADA, which is where the backer share comes from, and it is modest against the pledge. I would rather say that plainly than let anyone back this expecting the housing case's numbers. People fund this one because 4,900 riders get a working ramp."}]},
 {n:"Otis Bramble", s:"support", b:true, h:10, l:1421, t:"Median fix took nine days against a contract that says two. Nobody had to break the law to produce that. They just had to not care."},
 {n:"Junko Arai", s:"support", b:true, h:15, l:988, t:"My brother stopped taking the bus to his job and lost it. The bus did not stop running. It just stopped working for him."},
 {n:"Evan Doherty", s:"skeptical", b:false, h:22, l:402, t:"Consent decrees expire. Five years from now we are back here with a new board and the same ramps. The lasting-change score of 85 assumes an institution that wants to comply."},
  
 {n:"Rachida Bennani", s:"question", b:true, h:29, l:266, t:"Why is the independent monitor the sticking point? It seems like the cheapest thing on the list.",
  r:[{n:"Claire Donnelly", role:"Lead counsel, Equal Route Coalition", h:28, t:"Because it is the only part they cannot manage. Everything else they can report on themselves. In the three decrees I monitor, the monitor is the reason the numbers stayed honest in year four."}]},
 {n:"Lars Petersen", s:"support", b:false, h:37, l:533, t:"2,840 tickets. Each one is somebody standing in the rain watching a bus leave."},
 {n:"Chiamaka Eze", s:"support", b:true, h:48, l:611, t:"Backed. The clip explaining that a consent decree is a schedule and not a cheque should be shown to every new user on this platform."},
 {n:"Wilhelmina Frost", s:"skeptical", b:false, h:59, l:198, t:"98% funded and still trending. At some point the money should move to the cases that need it."}
],
"school-facial-rec":[
 {n:"Owen Aduba", s:"support", b:false, h:3, l:1102, t:"Counsel here, and I will say the uncomfortable thing first: 39 is a fair score. There is no controlling precedent in this state and the immunity defence is real. We are bringing it because someone has to be the case that makes the law, and because the contract we obtained is as clean a record as you will ever get.", role:"Lead counsel, Student Privacy Watch"},
 {n:"Elena Kovac", s:"support", b:true, h:7, l:1644, t:"Seven-year retention on the biometrics of a fourteen-year-old. That child will be twenty-one and the record will still be on a vendor's server, and no one in that family ever agreed to it."},
 {n:"Nathan Beaumont", s:"skeptical", b:false, h:12, l:701, t:"39% with a four-year lock-in and mostly injunctive relief. As a funding proposition this is the weakest on the site. As a precedent it may be the most important. Those two things are both true and the page is honest about it, which is why I backed it anyway."},
 {n:"Aiko Nakamura", s:"support", b:true, h:18, l:1288, t:"Plaintiff family. Our daughter told us. The school never did. That is the part people should sit with.",
  r:[{n:"Owen Aduba", role:"Lead counsel, Student Privacy Watch", h:17, t:"Eleven other families have come forward since the Nakamuras agreed to be named. That is what being named does, and it is not a small thing to ask of anyone."}]},
 {n:"Douglas Pike", s:"question", b:false, h:25, l:412, t:"The district paused new enrolment but kept the cameras on. Does the pause hurt the case by making it look moot?",
  r:[{n:"Owen Aduba", role:"Lead counsel, Student Privacy Watch", h:24, t:"It is the defence I expect them to run, and voluntary cessation is exactly the doctrine that answers it. A pause you can undo on a Tuesday does not moot a claim. But it does make the equities argument harder, which is the honest cost."}]},
 {n:"Bianca Rossi", s:"support", b:true, h:32, l:566, t:"940 districts in this state are waiting to see how this goes. Half of them have a vendor pitch in a drawer."},
 {n:"Ferdinand Achebe", s:"question", b:false, h:40, l:233, t:"If the case wins, does the deletion order actually reach the vendor, or only the district?"},
 {n:"Mia Lindgren", s:"support", b:false, h:54, l:388, t:"The agenda said 'facilities upgrade'. Four lines of minutes. That is the whole story of how this keeps happening."},
 {n:"Hector Salcedo", s:"skeptical", b:false, h:67, l:177, t:"No precedent in the state, immunity pleaded, no breach yet to point at. I admire the ambition and I am not putting money on it."}
]
};

/* Discussion at scale: the seeded threads above are the top of a much larger
   conversation, and these are the numbers underneath it. Stance counts feed
   the community pulse; ratings feed the community score. */
const DISCUSSION = {
  "asylum-backlog":  {total:14208, pulse:{support:9840,  question:2914, skeptical:1454}},
  "riverside-water": {total:8104,  pulse:{support:5901,  question:1402, skeptical:801}},
  "maple-evictions": {total:22617, pulse:{support:17244, question:3188, skeptical:2185}},
  "farmworker-wages":{total:4988,  pulse:{support:3106,  question:1214, skeptical:668}},
  "transit-access":  {total:11340, pulse:{support:8402,  question:1908, skeptical:1030}},
  "school-facial-rec":{total:6472, pulse:{support:3944,  question:1566, skeptical:962}}
};

/* Names and cities for the live activity ticker. Nothing here identifies a
   real person; it exists to show what the feed looks like when the platform
   is busy. */
const TICKER_NAMES = ["Amara","Jonas","Priya","Diego","Yuki","Noor","Thabo","Elena","Mateo","Ines","Kwame","Sofia","Anders","Leila","Ravi","Maeve","Tomas","Adaeze","Hugo","Ling"];
const TICKER_CITIES = ["Austin","Lisbon","Nairobi","Toronto","Manila","Berlin","Bogot\u00e1","Osaka","Dublin","S\u00e3o Paulo","Cape Town","Seattle","Warsaw","Lyon","Chicago","Bristol","Montr\u00e9al","Denver","Oslo","Perth"];

/* What the vetting badge opens. Five checks, run before a case is listed. */
const VETTING = [
  ["Counsel verified","Bar standing, disciplinary history and malpractice cover confirmed for lead counsel and the filing firm."],
  ["Case file reviewed","An independent litigator outside the firm read the complaint, the evidence index and the budget."],
  ["Budget tested","Every line checked against comparable filings in the same court. Anything above the band has to be justified in writing."],
  ["Plaintiff consent","Each named plaintiff confirmed, in their own language, that they understand public listing and what it exposes."],
  ["Conflicts cleared","Checked against every other case on the platform and against the firm's own client list."]
];

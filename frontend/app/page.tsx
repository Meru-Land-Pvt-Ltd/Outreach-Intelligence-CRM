import { redirect } from "next/navigation";

export default function Page() {
  redirect("/control-panel");
}

// import Link from "next/link";
// import {
//   ArrowRight,
//   Building2,
//   CircleDollarSign,
//   Database,
//   MailSearch,
//   Megaphone,
//   PlayCircle,
//   Route,
//   ShieldCheck,
//   Sparkles,
// } from "lucide-react";
// import { apiGet } from "@/lib/api";
// import { Badge, type BadgeVariant } from "@/components/ui/badge";
// import { Button } from "@/components/ui/button";
// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardHeader,
//   CardTitle
// } from "@/components/ui/card";
// import { Separator } from "@/components/ui/separator";
// import { PageHeader } from "@/components/shared/page-header";
// import { StatCard } from "@/components/shared/stat-card";

// async function safeCount(path: string) {
//   const response = await apiGet(path);
//   return response?.count || 0;
// }

// export default async function DashboardPage() {
//   const [
//     closedDeals,
//     rawVideos,
//     brands,
//     contacts,
//     emailDiscovery,
//     hunterRaw,
//     apolloRaw,
//     prospeoRaw,
//     enoylityRows,
//     mhdRows,
//     enoylityReviews,
//     mhdReviews,
//     excludedBrands
//   ] = await Promise.all([
//     safeCount("/sheets/closed-deals"),
//     safeCount("/raw-youtube?showAll=true"),
//     safeCount("/brand-map"),
//     safeCount("/contacts"),
//     safeCount("/email-discovery"),
//     safeCount("/email-discovery/hunter-raw"),
//     safeCount("/email-discovery/apollo-raw"),
//     safeCount("/email-discovery/prospeo-raw"),
//     safeCount("/instantly/enoylity"),
//     safeCount("/instantly/mhd"),
//     safeCount("/reviews/enoylity"),
//     safeCount("/reviews/mhd"),
//     safeCount("/sheets/excluded-brands")
//   ]);

//   const stats = [
//     { title: "Closed Deals", value: closedDeals, description: "Seed inputs" },
//     { title: "Raw Videos", value: rawVideos, description: "Crawled videos" },
//     { title: "BrandMap", value: brands, description: "Discovered brands" },
//     { title: "Contacts", value: contacts, description: "Email records" },
//     {
//       title: "Email Discovery",
//       value: emailDiscovery,
//       description: "Discovery rows"
//     },
//     {
//       title: "Hunter Raw",
//       value: hunterRaw,
//       description: "Hunter rows"
//     },
//     {
//       title: "Apollo Raw",
//       value: apolloRaw,
//       description: "Apollo rows"
//     },
//     {
//       title: "Prospeo Raw",
//       value: prospeoRaw,
//       description: "Prospeo rows"
//     },
//     {
//       title: "Enoylity Instantly",
//       value: enoylityRows,
//       description: "Exported rows"
//     },
//     {
//       title: "MHD Instantly",
//       value: mhdRows,
//       description: "Exported rows"
//     },
//     {
//       title: "Enoylity Reviews",
//       value: enoylityReviews,
//       description: "Channel uploads"
//     },
//     {
//       title: "MHD Reviews",
//       value: mhdReviews,
//       description: "Channel uploads"
//     },
//     {
//       title: "Excluded Brands",
//       value: excludedBrands,
//       description: "Skipped brands"
//     }
//   ];

//   const workflow = [
//     "Add closed deal",
//     "Run crawl",
//     "Analyze sponsor videos",
//     "Build BrandMap",
//     "Find domains",
//     "Discover emails",
//     "Verify contacts",
//     "Export Instantly rows",
//     "Fill competitors",
//     "Push campaign manually",
//     "Pull bounces"
//   ];

//   const status: {
//     label: string;
//     value: string;
//     variant: BadgeVariant;
//   }[] = [
//     { label: "Backend", value: "Configured", variant: "success" },
//     { label: "Worker", value: "Manual local run", variant: "secondary" },
//     { label: "Instantly", value: "Manual push", variant: "warning" }
//   ];

//   const quickLinks = [
//     {
//       title: "Closed Deals",
//       description: "Add seed deals.",
//       href: "/closed-deals",
//       icon: CircleDollarSign
//     },
//     {
//       title: "BrandMap",
//       description: "Review discovered brands.",
//       href: "/brand-map",
//       icon: Building2
//     },
//     {
//       title: "Email Discovery",
//       description: "Social/provider discovery.",
//       href: "/email-discovery",
//       icon: MailSearch
//     },
//     {
//       title: "Instantly",
//       description: "Export and push campaigns.",
//       href: "/instantly-campaigns",
//       icon: Megaphone
//     },
//     {
//       title: "Provider Raw Contacts",
//       description: "Hunter, Apollo, Prospeo.",
//       href: "/email-discovery/hunter-raw",
//       icon: Database
//     },
//     {
//       title: "Reviews",
//       description: "Enoylity and MHD uploads.",
//       href: "/reviews/enoylity",
//       icon: PlayCircle
//     }
//   ];

//   return (
//     <main className="w-full space-y-6">
//       <PageHeader
//         title="Dashboard"
//         description="Google Sheet aligned outreach intelligence CRM."
//       >
//         <Button asChild variant="outline">
//           <Link href="/closed-deals">
//             Add seed deal
//             <ArrowRight className="ml-2 h-4 w-4" />
//           </Link>
//         </Button>
//       </PageHeader>

//       <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
//         {stats.map((stat) => (
//           <StatCard
//             key={stat.title}
//             title={stat.title}
//             value={stat.value}
//             description={stat.description}
//           />
//         ))}
//       </section>

//       <section className="grid gap-6 xl:grid-cols-3">
//         <Card className="border-slate-200/70 shadow-sm xl:col-span-2">
//           <CardHeader>
//             <div className="flex items-center gap-2">
//               <Route className="h-4 w-4 text-slate-500" />
//               <CardTitle>Workflow</CardTitle>
//             </div>
//             <CardDescription>
//               Same flow as the old Google Apps Script tabs.
//             </CardDescription>
//           </CardHeader>

//           <CardContent>
//             <div className="grid gap-3 sm:grid-cols-2">
//               {workflow.map((item, index) => (
//                 <div
//                   key={item}
//                   className="flex items-center gap-3 rounded-2xl border bg-white p-4"
//                 >
//                   <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-900">
//                     {index + 1}
//                   </div>
//                   <p className="text-sm font-medium text-slate-700">{item}</p>
//                 </div>
//               ))}
//             </div>
//           </CardContent>
//         </Card>

//         <Card className="border-slate-200/70 shadow-sm">
//           <CardHeader>
//             <div className="flex items-center gap-2">
//               <ShieldCheck className="h-4 w-4 text-slate-500" />
//               <CardTitle>Status</CardTitle>
//             </div>
//             <CardDescription>
//               Export first, fill competitors, then push.
//             </CardDescription>
//           </CardHeader>

//           <CardContent className="space-y-4">
//             {status.map((item, index) => (
//               <div key={item.label}>
//                 <div className="flex items-center justify-between gap-4">
//                   <span className="text-sm text-slate-600">{item.label}</span>
//                   <Badge variant={item.variant}>{item.value}</Badge>
//                 </div>

//                 {index !== status.length - 1 ? (
//                   <Separator className="mt-4" />
//                 ) : null}
//               </div>
//             ))}
//           </CardContent>
//         </Card>
//       </section>

//       <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
//         {quickLinks.map((link) => {
//           const Icon = link.icon;

//           return (
//             <Button
//               key={link.href}
//               asChild
//               variant="outline"
//               className="h-auto justify-start rounded-2xl p-0 text-left"
//             >
//               <Link href={link.href} className="block w-full p-5">
//                 <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
//                   <Icon className="h-5 w-5 text-slate-700" />
//                 </div>

//                 <div className="flex items-center justify-between gap-3">
//                   <div>
//                     <p className="font-semibold text-slate-950">{link.title}</p>
//                     <p className="mt-1 text-sm font-normal text-slate-500">
//                       {link.description}
//                     </p>
//                   </div>

//                   <Sparkles className="h-4 w-4 text-slate-400" />
//                 </div>
//               </Link>
//             </Button>
//           );
//         })}
//       </section>
//     </main>
//   );
// }

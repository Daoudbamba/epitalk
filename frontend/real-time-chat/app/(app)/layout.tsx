"use client";

export default function AppLayout({ children }: { children: React.ReactNode }) {

  // useEffect(() => {
  //   if (!user) {
  //     router.push("/login");
  //   }
  // }, [user, router]);

  return (
    <div className="h-screen w-screen flex">
      <main className="flex-1">{children}</main>
    </div>
  );
}

export default function ChatroomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="h-screen w-full -m-20">{children}</div>;
}

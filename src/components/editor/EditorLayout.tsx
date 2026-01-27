"use client";

export default function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full h-screen flex bg-gray-100">

      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-md p-4">
        <h2 className="font-bold text-lg mb-4">Tools</h2>

        <ul className="space-y-3 text-sm">
          <li className="cursor-pointer hover:text-blue-600">Text</li>
          <li className="cursor-pointer hover:text-blue-600">Colors</li>
          <li className="cursor-pointer hover:text-blue-600">Upload Image</li>
          <li className="cursor-pointer hover:text-blue-600">Templates</li>
        </ul>
      </aside>

      {/* Main Canvas Area */}
      <main className="flex-1 p-6 overflow-auto bg-white">
        {children}
      </main>
    </div>
  );
}
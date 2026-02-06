import EditorShell from "@/components/editor/EditorShell";

export default function EditorRootPage() {
  return (
    <div className="h-screen flex flex-col">
      <EditorShell mode="new" />
    </div>
  );
}

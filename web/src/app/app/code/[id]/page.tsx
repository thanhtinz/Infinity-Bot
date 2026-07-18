import CodeEditorClient from './CodeEditorClient';

export default async function CodeProjectEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CodeEditorClient projectId={id} />;
}

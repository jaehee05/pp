import { PageHeader } from '../../components/PageHeader';

export function SimpleStub({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} desc="준비 중인 페이지입니다." />
      <div className="p-6">
        <div className="card flex h-80 items-center justify-center text-sm text-slate-400">
          곧 추가될 예정입니다.
        </div>
      </div>
    </>
  );
}

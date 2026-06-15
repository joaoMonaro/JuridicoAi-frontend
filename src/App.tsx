import { Button } from "@/components/ui/button";

function App() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50">
      <h1 className="text-3xl font-bold text-slate-800">Jurídico AI</h1>
      <div className="flex gap-3">
        <Button>Nova petição</Button>
        <Button variant="outline">Cancelar</Button>
        <Button variant="destructive">Excluir</Button>
      </div>
    </div>
  );
}

export default App;

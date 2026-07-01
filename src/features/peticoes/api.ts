type GerarPeticaoRequest = {
  fatoSimples: string;
};

type OpenAIResponse = {
  output: Array<{ content: Array<{ text: string }> }>;
};

const API_URL = import.meta.env.VITE_API_URL;

export async function gerarPeticao(fatoSimples: string): Promise<string> {
  const body: GerarPeticaoRequest = { fatoSimples };

  const response = await fetch(`${API_URL}/peticoes/gerar`, {
    method: "POST",
    headers: {
      "Content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Erro do servidor: ${response.status}`);
  }

  const data: OpenAIResponse = await response.json();

  const texto = data.output?.[0]?.content?.[0]?.text;

  if (!texto) {
    throw new Error("A resposta veio sem texto.");
  }

  return texto;
}

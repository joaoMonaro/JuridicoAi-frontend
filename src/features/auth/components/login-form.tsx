import { CircleAlert, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { login } from "@/features/auth/api/login";
import { saveAuthSession } from "@/features/auth/auth-session";
import type { LoginInput } from "@/features/auth/types";
import { ApiError } from "@/lib/api-client";

type LoginErrors = Partial<Record<keyof LoginInput, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(values: LoginInput): LoginErrors {
  const errors: LoginErrors = {};
  const email = values.email.trim();

  if (!email) errors.email = "Informe seu e-mail.";
  else if (!EMAIL_PATTERN.test(email)) errors.email = "Informe um e-mail válido.";
  if (!values.senha) errors.senha = "Informe sua senha.";

  return errors;
}

function loginErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return "Não foi possível entrar. Tente novamente.";
  if (error.status === 0) return "Não foi possível conectar ao servidor. Verifique se a API está disponível.";
  if (error.status === 401) return "E-mail ou senha inválidos.";
  if (error.status === 429) return "Muitas tentativas de acesso. Aguarde um momento e tente novamente.";
  if (error.code === "ORGANIZATION_SELECTION_REQUIRED") return "Sua conta está vinculada a mais de um escritório. Selecione o escritório para continuar.";
  return error.message;
}

function destinationAfterLogin() {
  const redirect = new URLSearchParams(window.location.search).get("redirect");
  return redirect?.startsWith("/") && !redirect.startsWith("//") ? redirect : "/casos";
}

export function LoginForm() {
  const [values, setValues] = useState<LoginInput>({ email: "", senha: "" });
  const [touched, setTouched] = useState<Record<keyof LoginInput, boolean>>({ email: false, senha: false });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const errors = useMemo(() => validate(values), [values]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({ email: true, senha: true });
    if (Object.keys(errors).length > 0 || submitting) return;

    setSubmitting(true);
    setSubmitError("");

    try {
      const response = await login({ email: values.email.trim(), senha: values.senha });
      saveAuthSession(response);
      window.location.replace(destinationAfterLogin());
    } catch (error) {
      setSubmitError(loginErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  const emailError = touched.email ? errors.email : undefined;
  const passwordError = touched.senha ? errors.senha : undefined;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="login-email" className="text-sm font-medium">E-mail</label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id="login-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            placeholder="voce@escritorio.com.br"
            className="h-11 pl-10"
            value={values.email}
            onChange={(event) => {
              setValues((current) => ({ ...current, email: event.target.value }));
              setSubmitError("");
            }}
            onBlur={() => setTouched((current) => ({ ...current, email: true }))}
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? "login-email-error" : undefined}
          />
        </div>
        {emailError && <p id="login-email-error" role="alert" className="text-xs text-destructive">{emailError}</p>}
      </div>

      <div className="space-y-2">
        <label htmlFor="login-password" className="text-sm font-medium">Senha</label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id="login-password"
            name="senha"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Digite sua senha"
            className="h-11 px-10"
            value={values.senha}
            onChange={(event) => {
              setValues((current) => ({ ...current, senha: event.target.value }));
              setSubmitError("");
            }}
            onBlur={() => setTouched((current) => ({ ...current, senha: true }))}
            aria-invalid={Boolean(passwordError)}
            aria-describedby={passwordError ? "login-password-error" : undefined}
          />
          <button
            type="button"
            className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {passwordError && <p id="login-password-error" role="alert" className="text-xs text-destructive">{passwordError}</p>}
      </div>

      {submitError && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{submitError}</span>
        </div>
      )}

      <Button type="submit" size="lg" className="h-11 w-full" disabled={submitting}>
        {submitting && <LoaderCircle className="animate-spin" aria-hidden="true" />}
        {submitting ? "Entrando..." : "Entrar"}
      </Button>

      <p className="text-center text-xs leading-5 text-muted-foreground">
        Utilize as credenciais fornecidas pelo seu escritório.
      </p>
    </form>
  );
}

export interface SecretPattern {
    id: string;
    name: string;
    regex: RegExp;
    severity: "low" | "medium" | "high" | "critical";
  }
  
  export const SECRET_PATTERNS: SecretPattern[] = [
    {
      id: "aws_access_key",
      name: "AWS Access Key ID",
      regex: /AKIA[0-9A-Z]{16}/g,
      severity: "critical",
    },
    {
      id: "aws_secret_key",
      name: "AWS Secret Access Key",
      regex: /(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/g,
      severity: "critical",
    },
    {
      id: "stripe_secret_key",
      name: "Stripe Secret Key",
      regex: /sk_(live|test)_[0-9a-zA-Z]{24,}/g,
      severity: "critical",
    },
    {
      id: "stripe_publishable_key",
      name: "Stripe Publishable Key",
      regex: /pk_(live|test)_[0-9a-zA-Z]{24,}/g,
      severity: "low",
    },
    {
      id: "slack_webhook",
      name: "Slack Webhook URL",
      regex: /https:\/\/hooks\.slack\.com\/services\/T[0-9A-Z]+\/B[0-9A-Z]+\/[0-9A-Za-z]+/g,
      severity: "high",
    },
    {
      id: "slack_token",
      name: "Slack Token",
      regex: /xox[baprs]-[0-9A-Za-z-]{10,}/g,
      severity: "high",
    },
    {
      id: "supabase_service_role_key",
      name: "Supabase Service Role Key (JWT)",
      regex: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g,
      severity: "critical",
    },
    {
      id: "github_pat",
      name: "GitHub Personal Access Token",
      regex: /ghp_[0-9A-Za-z]{36}/g,
      severity: "critical",
    },
    {
      id: "github_oauth_token",
      name: "GitHub OAuth Token",
      regex: /gho_[0-9A-Za-z]{36}/g,
      severity: "critical",
    },
    {
      id: "openai_api_key",
      name: "OpenAI API Key",
      regex: /sk-[A-Za-z0-9]{20,}T3BlbkFJ[A-Za-z0-9]{20,}/g,
      severity: "critical",
    },
    {
      id: "groq_api_key",
      name: "Groq API Key",
      regex: /gsk_[A-Za-z0-9]{20,}/g,
      severity: "critical",
    },
    {
      id: "generic_api_key_assignment",
      name: "Posible API Key genérica",
      regex: /(api[_-]?key|apikey|secret[_-]?key)\s*[:=]\s*["']([A-Za-z0-9_\-]{16,})["']/gi,
      severity: "medium",
    },
    {
      id: "private_key_block",
      name: "Clave privada (PEM)",
      regex: /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
      severity: "critical",
    },
    {
      id: "database_connection_string",
      name: "Cadena de conexión a base de datos",
      regex: /(postgres(ql)?|mysql|mongodb(\+srv)?):\/\/[^\s"']+:[^\s"']+@[^\s"']+/gi,
      severity: "high",
    },
  ];
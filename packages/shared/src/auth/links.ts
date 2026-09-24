/**
 * As páginas da web para onde os e-mails da API apontam. O e-mail é escrito
 * pela API e a página é da web — por isso o caminho mora aqui, e não duplicado
 * nos dois lados. Um link de e-mail que não abre nada só se descobre quando
 * alguém reclama que o convite não funciona.
 *
 * Em português, como toda URL que o usuário lê (docs/web/arquitetura.md §3).
 * O token vai na query: caminho de URL entra em log de servidor e em `Referer`.
 */
export const PAGINAS_DOS_EMAILS = {
  aceitarConvite: '/aceitar-convite',
  redefinirSenha: '/redefinir-senha',
} as const;

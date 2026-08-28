import { FormControl } from '@angular/forms';

/**
 * Apara o espaço em volta de um e-mail digitado, **antes** de validar.
 *
 * Copiar e colar traz espaço junto — de um e-mail, de uma mensagem, de um
 * gerenciador de senhas. E `Validators.email` é ancorado: `" a@b.com "` reprova.
 * Aparando só na hora de enviar, o `submit` já voltou sem fazer nada, e o clique
 * some sem explicação — que é exatamente o que parece um sistema quebrado.
 *
 * Vale para e-mail e não para senha: espaço é caractere legítimo de senha, e
 * apará-lo em silêncio mudaria a credencial de quem escolheu usar um.
 */
export function aparaEmail(campo: FormControl<string>): void {
  const aparado = campo.value.trim();
  if (aparado !== campo.value) campo.setValue(aparado);
}

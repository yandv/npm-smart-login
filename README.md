# 🔐 npm-smart-login

**npm-smart-login** é uma ferramenta CLI (linha de comando) desenvolvida para gerenciar múltiplos perfis de contas do NPM/PNPM na mesma máquina, e contornar as restrições recentes de segurança do NPM gerando **tokens de longa duração (90 dias)** de forma simples e automatizada.

Desde que o NPM reduziu os tokens clássicos de terminal para **2 horas de duração**, trabalhar com múltiplos pacotes privados ou contas se tornou exaustivo. O `npm-smart-login` automatiza o processo de gerar Granular Access Tokens (GATs) para múltiplas contas e injetá-los no seu `~/.npmrc`.

## ✨ Funcionalidades

- **Gerenciamento de Multi-Contas**: Mantenha perfis separados e troque entre eles com um único comando.
- **Tokens de Longa Duração (90 dias)**: O sistema automatiza a criação de Granular Tokens usando sua sessão do navegador.
- **Bypass de 2FA Inteligente**: Ao solicitar um token que pule o 2FA para automações, o NPM exige que os pacotes sejam nomeados. O `npm-smart-login` busca todos os seus pacotes privados automaticamente e injeta os escopos corretos sem você precisar digitar nada.
- **Comando `exec` (Temporário)**: Rode um comando numa conta específica sem precisar trocar o seu perfil global atual.
- **Aviso de Expiração Inteligente**: Comando `check` que avisa no seu terminal se algum token estiver a menos de 14 dias de expirar.

## 🚀 Como usar

### 1. Trocar de conta globalmente
Altera o ambiente para a conta desejada (cria o perfil se não existir).
```bash
npm-smart-login switch <nome-da-conta>
# Exemplo: npm-smart-login switch trabalho
```

### 2. Gerar Token (Login de 90 dias)
Faça o login com duração de 90 dias na conta atual. Ele perguntará se você deseja bypass de 2FA (útil se você roda deploys automáticos locais) e cuidará dos pacotes para você.
```bash
npm-smart-login login
```
*(Você precisará interagir e autenticar via navegador quando o CLI do NPM abrir a janela).*

### 3. Executar comando em perfil diferente sem trocar globalmente
Útil para instalar ou publicar um pacote usando as credenciais de outra conta sem afetar o estado global do seu terminal atual.
```bash
npm-smart-login exec <conta> <comando>
# Exemplo: npm-smart-login exec trabalho pnpm publish
# Exemplo: npm-smart-login exec pessoal pnpm install @meu-pacote-privado
```
> **🪄 Mágica para Agentes e CI (WebAuthn):** O NPM baniu tokens de Bypass 2FA para publicação direta. Ao rodar um comando de `publish` em terminais não-interativos (como agentes autônomos), o registry bloqueia e esconde a URL de aprovação Web. 
> 
> O `npm-smart-login exec` resolve isso automaticamente: se ele detectar a palavra `publish` no seu comando, ele envelopará o processo num TTY simulado (usando o `script`). Isso força o NPM/PNPM a gerar a **URL de aprovação no navegador (WebAuthn)**, permitindo que agentes repassem o link no chat para você apenas clicar e aprovar o deploy!

### 4. Checar expiração dos tokens
Verifica se algum token seu está expirando em menos de 14 dias e te notifica.
```bash
npm-smart-login check
```
*(Dica: Você pode colocar este comando no seu `~/.zshrc` ou `~/.bashrc` para rodar automaticamente toda vez que abrir um terminal).*

## 🛠️ Tecnologias
Construído com **Node.js, TypeScript, Inquirer e Execa**.

## 📝 Licença
MIT License.

# CutHub

Sistema de gestão para barbearias com agendamento, gerenciamento de clientes, histórico de atendimentos e reconhecimento facial.

---

# Visão Geral

O CutHub foi desenvolvido com o objetivo de digitalizar e organizar a rotina de uma barbearia através de uma única plataforma.

O sistema permite gerenciar clientes, barbeiros, serviços, disponibilidade de horários, agendamentos e histórico de cortes, além de utilizar reconhecimento facial para identificação de clientes durante o atendimento.

O projeto foi desenvolvido utilizando Python, FastAPI, SQLite, HTML, CSS, JavaScript, OpenCV e DeepFace.

---

# Principais Funcionalidades

## Gestão de Clientes

- Cadastro de clientes
- Histórico de atendimentos
- Registro de preferências
- Foto de referência do cliente
- Busca rápida de clientes

## Gestão de Barbeiros

- Cadastro de barbeiros
- Controle de disponibilidade
- Associação de agendamentos

## Agendamentos

- Criação de agendamentos
- Seleção de cliente
- Seleção de barbeiro
- Seleção de serviço
- Controle de data e horário
- Visualização em calendário

## Histórico

- Registro completo dos atendimentos
- Consulta de atendimentos anteriores
- Fotos antes e depois
- Observações do atendimento

## Tablet do Barbeiro

- Interface simplificada para uso durante o atendimento
- Calendário semanal
- Próximos clientes
- Fluxo de reconhecimento facial
- Controle de status do atendimento

## Reconhecimento Facial

- Captura de imagem pela webcam
- Comparação facial utilizando DeepFace
- Identificação automática de clientes cadastrados
- Exibição de informações do cliente reconhecido
- Validação por nível mínimo de confiança

---

# Tecnologias Utilizadas

## Backend

- Python
- FastAPI
- SQLAlchemy
- SQLite

## Frontend

- HTML5
- CSS3
- JavaScript

## Visão Computacional

- OpenCV
- DeepFace
- FaceNet

---

# Estrutura do Projeto

```text
CutHub
│
├── backend
│   ├── app
│   │   ├── crud.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── database.py
│   │   └── main.py
│   │
│   └── requirements
│
├── frontend
│   ├── assets
│   │   ├── css
│   │   ├── js
│   │   ├── client-faces
│   │   └── uploads
│   │
│   └── index.html
│
├── data
│
└── README.md
```

---

# Perfis de Usuário

O sistema possui três perfis principais.

## Administrador

Responsável pelo gerenciamento geral.

Permissões:

- Cadastrar barbeiros
- Cadastrar clientes
- Criar usuários
- Excluir usuários
- Gerenciar serviços
- Visualizar histórico
- Gerenciar disponibilidade
- Acompanhar atendimentos

---

## Barbeiro

Responsável pelos atendimentos.

Permissões:

- Visualizar agenda
- Utilizar o tablet
- Realizar reconhecimento facial
- Registrar fotos antes e depois
- Finalizar atendimentos
- Consultar histórico

---

## Cliente

Responsável pelos próprios agendamentos.

Permissões:

- Consultar informações pessoais
- Visualizar histórico
- Criar agendamentos

---

# Como Executar o Projeto

## 1. Clonar o Repositório

```bash
git clone URL_DO_REPOSITORIO
```

---

## 2. Entrar na Pasta

```bash
cd CutHub
```

---

## 3. Criar Ambiente Virtual

```bash
python -m venv .venv
```

---

## 4. Ativar Ambiente Virtual

Windows:

```bash
.venv\Scripts\activate
```

Linux:

```bash
source .venv/bin/activate
```

---

## 5. Instalar Dependências

```bash
pip install -r requirements.txt
```

---

## 6. Executar o Backend

Entrar na pasta backend:

```bash
cd backend
```

Executar:

```bash
uvicorn app.main:app --reload
```

Servidor:

```text
http://127.0.0.1:8000
```

---

# Fluxo Completo de Utilização

## 1. Cadastro de Barbeiros

Acessar:

```text
Usuários
```

Criar um usuário com perfil:

```text
Barbeiro
```

---

## 2. Cadastro de Clientes

Acessar:

```text
Clientes
```

Cadastrar:

- Nome
- Telefone
- Observações
- Foto facial

---

## 3. Configurar Disponibilidade

Acessar:

```text
Disponibilidade
```

Selecionar:

- Barbeiro
- Dia
- Horário

Salvar.

---

## 4. Criar Agendamento

Acessar:

```text
Agendamentos
```

Selecionar:

- Cliente
- Barbeiro
- Serviço
- Data
- Horário

Salvar.

---

## 5. Atendimento

No módulo Tablet:

1. Selecionar o atendimento.
2. Abrir reconhecimento facial.
3. Capturar imagem.
4. Realizar comparação facial.
5. Confirmar cliente identificado.
6. Registrar foto antes.
7. Realizar atendimento.
8. Registrar foto depois.
9. Finalizar atendimento.

---

## 6. Histórico

Após finalizar o atendimento:

- Fotos são armazenadas
- Informações são registradas
- Cliente passa a possuir histórico atualizado

---

# Reconhecimento Facial

## Funcionamento

O reconhecimento facial utiliza:

- OpenCV para captura de imagens
- DeepFace para comparação facial
- FaceNet para extração de características

Fluxo:

```text
Webcam
↓
Captura da imagem
↓
DeepFace
↓
Comparação com clientes cadastrados
↓
Validação de confiança
↓
Identificação do cliente
```

---

## Regras de Validação

O sistema somente identifica um cliente quando a confiança mínima configurada é atingida.

Casos rejeitados:

- Imagem totalmente escura
- Webcam bloqueada
- Rosto não identificado
- Similaridade insuficiente

---

# Serviços Disponíveis

Atualmente o sistema trabalha com:

- Corte
- Corte e Barba
- Barba
- Sobrancelha
- Luzes

---

# Organização dos Atendimentos

## Azul

```text
Agendado
```

## Amarelo

```text
Em atendimento
```

## Verde

```text
Finalizado
```

---

# Banco de Dados

O sistema utiliza SQLite.

Principais entidades:

- Users
- Clients
- Barbers
- Services
- Appointments
- Availability
- HaircutHistory

---

# Melhorias Futuras

- Notificações automáticas
- Confirmação de agendamentos por e-mail
- Integração com WhatsApp
- Dashboard financeiro
- Relatórios avançados
- Reconhecimento facial em tempo real
- Aplicativo mobile

---

# Considerações Finais

O CutHub foi desenvolvido com foco em usabilidade, organização e automação da rotina de uma barbearia.

O projeto busca unir gestão administrativa e visão computacional em uma única plataforma, oferecendo uma solução moderna para controle de clientes, atendimentos e agendamentos.

---

# Autor

 Guilherme Santos

Estudante de Ciência da Computação

Projeto desenvolvido para fins acadêmicos na disciplina de Computação Gráfica.
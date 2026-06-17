# CutHub

Sistema de gestão para barbearias desenvolvido para a disciplina de Computação Gráfica.

O projeto centraliza clientes, barbeiros, serviços, agendamentos, disponibilidade, histórico de atendimentos e reconhecimento facial em uma única plataforma.

---

# Visão Geral

O CutHub foi criado para auxiliar a organização da rotina de uma barbearia por meio de uma interface única para administração e operação dos atendimentos.

O sistema permite:

* Cadastro e gerenciamento de clientes
* Cadastro e gerenciamento de barbeiros
* Controle de disponibilidade
* Agendamentos de serviços
* Histórico de cortes com registros fotográficos
* Reconhecimento facial para identificação de clientes
* Integração com calendários externos

Tecnologias utilizadas:

* Python
* FastAPI
* SQLite
* HTML
* CSS
* JavaScript
* OpenCV
* DeepFace

---

# Funcionalidades

## Clientes

* Cadastro de clientes
* Consulta de histórico
* Registro de observações
* Foto facial para reconhecimento
* Busca de clientes

## Barbeiros

* Cadastro de barbeiros
* Controle de disponibilidade
* Agenda de atendimentos

## Serviços

Serviços cadastrados:

* Corte
* Corte e Barba
* Barba
* Sobrancelha
* Luzes

## Agendamentos

* Criação de agendamentos
* Seleção de cliente
* Seleção de barbeiro
* Seleção de serviço
* Controle de data e horário
* Visualização em calendário

## Integração com Calendários

Após a confirmação do agendamento, o sistema permite:

* Abrir o compromisso diretamente no Google Agenda
* Gerar arquivo .ICS compatível com Apple Calendar
* Compatibilidade com Outlook
* Compatibilidade com Calendário do Windows

## Histórico de Atendimentos

* Registro dos atendimentos realizados
* Fotos antes e depois
* Observações do atendimento
* Consulta de cortes anteriores

## Tablet do Barbeiro

* Interface adaptada para tablets
* Calendário semanal
* Visualização dos atendimentos
* Fluxo de reconhecimento facial
* Consulta rápida de informações do cliente

## Reconhecimento Facial

* Captura por webcam
* Comparação facial com DeepFace
* Identificação de clientes cadastrados
* Exibição das informações do cliente reconhecido

---

# Perfis de Usuário

## Administrador

Permissões:

* Gerenciar clientes
* Gerenciar barbeiros
* Gerenciar usuários
* Gerenciar serviços
* Gerenciar disponibilidade
* Consultar histórico

## Barbeiro

Permissões:

* Visualizar agenda
* Utilizar o modo tablet
* Realizar reconhecimento facial
* Registrar atendimentos
* Consultar histórico

## Cliente

Permissões:

* Criar agendamentos
* Consultar histórico
* Visualizar informações pessoais

---

# Tecnologias

## Backend

* Python
* FastAPI
* SQLAlchemy
* SQLite

## Frontend

* HTML5
* CSS3
* JavaScript

## Visão Computacional

* OpenCV
* DeepFace
* FaceNet

---

# Estrutura do Projeto


CutHub
│
├── backend
│   ├── app
│   │   ├── crud.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── database.py
│   │   └── main.py
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
└── README.md


---

# Banco de Dados

Principais entidades:

* Users
* Clients
* Barbers
* Services
* Appointments
* Availability
* HaircutHistory

---

# Execução

git clone URL_DO_REPOSITORIO
cd CutHub

python -m venv .venv
.venv\Scripts\activate

pip install -r requirements.txt

cd backend
uvicorn app.main:app --reload

Servidor:

http://127.0.0.1:8000

---

# Fluxo Básico

1. Cadastrar barbeiros
2. Cadastrar clientes
3. Definir disponibilidade
4. Criar agendamentos
5. Realizar atendimento
6. Registrar fotos
7. Finalizar atendimento
8. Consultar histórico

---

# Autor

Guilherme Santos

Estudante de Ciência da Computação

Projeto desenvolvido para fins acadêmicos na disciplina de Computação Gráfica.
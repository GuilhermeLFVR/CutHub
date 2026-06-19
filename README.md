# CutHub

## Plataforma SaaS para Gestão Inteligente de Barbearias

O CutHub é uma plataforma completa desenvolvida para gerenciamento de barbearias, unindo automação operacional, reconhecimento facial, histórico fotográfico, assinaturas recorrentes e análise de dados em uma única solução.

O projeto foi desenvolvido utilizando FastAPI, SQLite, HTML, CSS, JavaScript, OpenCV e DeepFace, permitindo administrar toda a jornada do cliente, desde o agendamento até a análise estratégica dos resultados do negócio.

---

# Visão Geral

O sistema foi projetado para resolver problemas comuns encontrados em barbearias:

- Falta de organização de agendamentos
- Dependência de aplicativos de mensagem
- Perda de histórico de clientes
- Dificuldade para identificar preferências dos clientes
- Falta de indicadores de desempenho
- Ausência de modelos de receita recorrente

Para solucionar esses problemas, o CutHub centraliza informações operacionais, financeiras e analíticas em uma única plataforma.

---

# Principais Módulos

## Dashboard

Painel central com indicadores operacionais e gerenciais.

### Indicadores disponíveis

- Receita diária
- Quantidade de atendimentos
- Clientes cadastrados
- Serviços cadastrados
- Agenda do dia
- Resumo operacional

---

## Gestão de Clientes

Permite administrar toda a base de clientes.

### Funcionalidades

- Cadastro de clientes
- Busca inteligente
- Histórico individual
- Observações personalizadas
- Controle de bloqueio
- Preferências de atendimento
- Fotos de referência

---

## Gestão de Barbeiros

- Cadastro de barbeiros
- Disponibilidade individual
- Controle de agenda
- Associação com atendimentos

---

## Gestão de Serviços

Serviços padrão:

- Corte
- Corte e Barba
- Barba
- Sobrancelha
- Luzes

Cada serviço possui:

- Preço
- Duração
- Disponibilidade

---

## Sistema de Agendamento

### Recursos

- Seleção de cliente
- Seleção de barbeiro
- Seleção de serviço
- Controle de horários ocupados
- Calendário integrado
- Exportação para agenda

### Integrações

- Google Calendar
- Apple Calendar
- Outlook
- Arquivos ICS

---

## Histórico de Atendimentos

Cada atendimento pode armazenar:

- Serviço realizado
- Data
- Horário
- Fotos antes e depois
- Observações
- Valor do serviço

---

# Reconhecimento Facial

Um dos diferenciais do projeto.

## Tecnologias

- OpenCV
- DeepFace
- FaceNet

## Fluxo

1. Cliente chega à barbearia
2. Webcam captura imagem
3. DeepFace compara os rostos cadastrados
4. Sistema identifica o cliente
5. Histórico e preferências são exibidos automaticamente

---

# Tablet do Barbeiro

Interface dedicada para utilização durante o atendimento.

### Recursos

- Agenda semanal
- Reconhecimento facial
- Consulta rápida de histórico
- Registro de atendimento
- Fotos antes e depois
- Finalização do serviço

---

# Sistema de Assinaturas

O CutHub possui um módulo completo de recorrência.

## Planos

### Hub Start

- 1 utilização mensal

### Hub Plus

- Até 4 utilizações mensais

### Hub Unlimited

- Utilização ilimitada

### Hub Elite

- Plano premium

---

# Business Intelligence e Analytics

O módulo analítico foi desenvolvido para transformar dados operacionais em informações estratégicas.

## Indicadores de Receita

### Receita Recorrente (MRR)

Calcula a previsão mensal baseada em assinaturas ativas.

### Receita Operacional

Calcula a receita gerada pelos atendimentos concluídos.

### Receita Total

Combinação entre receita recorrente e receita operacional.

---

## Indicadores de Assinaturas

- Clientes assinantes
- Clientes sem plano
- Taxa de adoção
- Ticket médio
- Participação por plano

---

## Indicadores de Utilização

- Utilização do plano
- Consumo mensal
- Quantidade de atendimentos
- Engajamento do cliente

---

## Economia Estimada

Compara:

Valor consumido em serviços

versus

Valor pago na assinatura

Permitindo identificar o retorno percebido pelo cliente.

---

## Ranking de Clientes

Classificação baseada em:

- Receita recorrente
- Utilização do plano
- Economia gerada
- Engajamento

---

## Insights Automáticos

O sistema gera observações automáticas como:

- Plano mais popular
- Participação percentual dos planos
- Receita prevista
- Receita recorrente versus operacional
- Serviço mais vendido
- Clientes com baixa utilização

---

## Previsão de Renovação

Indicador analítico baseado em:

- Utilização do plano
- Economia gerada
- Frequência de uso

Classificação:

- Alta chance
- Média chance
- Baixa chance

---

# Perfis de Usuário

## Administrador

Permissões:

- Clientes
- Barbeiros
- Usuários
- Serviços
- Assinaturas
- Analytics
- Histórico
- Disponibilidade

## Barbeiro

Permissões:

- Agenda
- Tablet
- Reconhecimento facial
- Histórico

## Cliente

Permissões:

- Agendamentos
- Histórico pessoal
- Assinaturas

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

# Estrutura Principal

## Frontend

- dashboard.js
- booking.js
- clients.js
- history.js
- tablet.js
- subscriptions.js
- users.js
- router.js
- api.js

## Backend

- main.py
- crud.py
- models.py
- schemas.py
- auth.py
- database.py

---

# Objetivos Acadêmicos

O projeto demonstra conceitos relacionados a:

- Desenvolvimento Web Full Stack
- APIs REST
- Banco de Dados Relacional
- Engenharia de Software
- Visão Computacional
- Reconhecimento Facial
- Sistemas SaaS
- Receita Recorrente
- Business Intelligence
- Análise de Dados
- Indicadores de Negócio
- Tomada de Decisão Baseada em Dados

---

# Autor

Guilherme dos Santos

Projeto desenvolvido para fins acadêmicos na graduação em Ciência da Computação.
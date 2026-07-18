# Fluxo de pagamento (assinatura recorrente)

O Zaldo usa a API de **Assinaturas (preapproval)** do Mercado Pago: o usuário cadastra o
cartão uma vez e o MP renova sozinho (mensal ou anual). Não guardamos dados de cartão —
o checkout é hospedado pelo próprio Mercado Pago.

```mermaid
sequenceDiagram
    autonumber
    participant U as Usuário
    participant Z as Zaldo (server)
    participant MP as Mercado Pago
    participant WH as Webhook /api/webhooks/mercadopago

    Note over U,Z: trial de 7 dias expira → parede de planos
    U->>Z: escolhe plano (Individual/Família/Anual)
    Z->>MP: POST /preapproval (valor, recorrência,<br/>external_reference = workspace:plano)
    MP-->>Z: init_point (URL do checkout)
    Z-->>U: redirect para o checkout do MP
    U->>MP: cadastra cartão e confirma
    MP->>WH: notificação (data.id)
    WH->>WH: valida HMAC do x-signature
    WH->>MP: GET /preapproval/{id} (fonte da verdade)
    MP-->>WH: status = authorized
    WH->>Z: ativa assinatura do workspace<br/>(status active, trial encerrado)
    WH->>Z: registra payment.authorized na auditoria
    MP-->>U: redirect de volta (/planos/retorno)
    U->>Z: volta ao painel — plano ativo
```

## Estados e cancelamento

| Evento no MP | Efeito no Zaldo |
|---|---|
| `authorized` | Plano ativado, `trialEndsAt` limpo, ids do gateway salvos |
| `cancelled` / `paused` | Assinatura marcada como `canceled` — na próxima navegação o dono cai na parede de planos |

O cancelamento derruba **apenas** se o id da assinatura cancelada é o mesmo que ativou o
workspace — uma assinatura antiga cancelada não afeta um plano recém-contratado.

## Por que nunca confiar no payload do webhook?

Qualquer um pode enviar um POST pro endpoint. Por isso:

1. **Assinatura HMAC**: o header `x-signature` é validado contra o secret do app
   (manifest oficial `id:…;request-id:…;ts:…;`, comparação em tempo constante).
2. **Re-busca**: mesmo com assinatura válida, o estado usado é o que a API do MP retorna
   pro nosso token — o corpo da notificação serve só para saber *qual* assinatura consultar.

Um payload forjado, no máximo, nos faz consultar uma assinatura que não existe.

## Modo desenvolvimento

Sem `MERCADOPAGO_ACCESS_TOKEN` no ambiente, a escolha de plano ativa direto (sem cobrança) —
permite testar todo o fluxo de trial/parede/planos localmente sem tocar no gateway.

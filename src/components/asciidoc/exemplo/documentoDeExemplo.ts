/**
 * Documento AsciiDoc de exemplo: exercita a gramática inteira que o editor suporta. Serve ao App de demonstração e
 * ao teste de round-trip.
 */
export const DOCUMENTO_DE_EXEMPLO = `= Guia do editor AsciiDoc
Equipe Tootega <anvil@tootega.com.br>
v1.0, 2026-10-28: primeira versão
:toc:
:experimental:
:produto: Tootega ANVIL

Este é o editor AsciiDoc do {produto}: edição *visual* e de _código_, com \`realce\`, tudo em código nosso.

[.lead]
O parágrafo de abertura usa o papel lead.

== Formatação de texto

Negrito com *asteriscos*, itálico com _sublinhados_, monoespaçado com \`crases\`, #realce# com cerquilhas, ^sobrescrito^ e ~subscrito~.
Formas unconstrained: **N**egrito no meio da palavra, __i__tálico, \`\`m\`\`ono e ##r##ealce.
Papéis: [.underline]#sublinhado#, [.line-through]#tachado# e [.destaque]#papel próprio#.
Aninhado: *negrito com _itálico_ dentro* e uma linha forçada +
na segunda linha.

Links: https://asciidoc.org[AsciiDoc], https://tootega.com.br, link:docs/guia.html[Guia] e mailto:anvil@tootega.com.br[Fale conosco].
Referências: <<formatacao,a seção anterior>>, <<tabelas>> e xref:outro.adoc#secao[outro documento].
Macros de interface: kbd:[Ctrl+S], btn:[Salvar] e menu:Arquivo[Salvar como].
Nota de rodapé.footnote:[O texto da nota.] Imagem inline image:icone.png[ícone] e passagem +++<b>bruto</b>+++.

[[formatacao]]
=== Escapes

Um \\*asterisco* literal, um \\{atributo} literal e a palavra +*literal*+ em passagem.

== Listas

* Primeiro item
* Segundo item
** Subitem
*** Sub-subitem
* Terceiro item
+
Parágrafo anexado ao terceiro item.

. Passo um
. Passo dois
.. Subpasso
. Passo três

* [x] Tarefa concluída
* [ ] Tarefa pendente

Termo:: Definição do termo.
Outro termo::
Definição na linha seguinte.
Termo aninhado::: Definição aninhada.

== Blocos

NOTE: Admonição em parágrafo.

[TIP]
====
Admonição em bloco, com *formatação* e uma lista:

* um
* dois
====

[IMPORTANT]
====
Importante.
====

WARNING: Cuidado com o que escreve.

CAUTION: Atenção.

.Título do exemplo
====
Bloco de exemplo com título.
====

.Barra lateral
****
Conteúdo da barra lateral.
****

[quote, Fernando Pessoa, Mensagem]
____
Tudo vale a pena se a alma não é pequena.
____

[verse, Autor, Fonte]
____
Primeiro verso
segundo verso
____

--
Bloco aberto.
--

> Citação em estilo Markdown.
> -- Autor

== Código

[source,typescript]
----
export function somar(pA: number, pB: number): number {
  // devolve a soma
  return pA + pB; // <1>
}
----
<1> A chamada explica a linha.

[source,csharp]
----
public sealed class Pessoa { public string Nome { get; init; } = ""; }
----

\`\`\`sql
SELECT Nome, COUNT(*) AS Total FROM SYSxPessoa WHERE Ativo = 1 GROUP BY Nome;
\`\`\`

----
Listagem sem linguagem.
----

....
Bloco literal
  com recuo preservado.
....

 Parágrafo literal indentado.

++++
<div class="bruto">passagem</div>
++++

////
Comentário em bloco.
////

// Comentário de linha.

[[tabelas]]
== Tabelas

.Clientes
[cols="1,2,1",options="header"]
|===
|Código |Nome |Situação

|001 |Empresa Alfa |Ativa
|002 |Empresa Beta |Inativa
2+^|Mesclada ao centro |Fim
|===

[%header,cols=2*]
|===
|A |B
|1 |2
|===

== Mídia e quebras

.Logotipo
image::logo.png[Logotipo,200,100]

video::intro.mp4[width=640]

'''

<<<

:atributo-no-corpo: valor

include::outro.adoc[]

toc::[]
`;

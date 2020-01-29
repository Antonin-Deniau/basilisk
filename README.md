# basilisk

A simple prototype of interpreted lisp-like language written in js.

example:

```
<import "io">
<import "arr">

"C'est un commentaire en texte"
<func greeting <name>
  <+ "Hello " name " !">
>

<func greet_everyones_except <names except> 
  <<arr.pipe
    <arr.filter <func <name> <!= name except>>>
    <arr.map greeting>
    <arr.join "\n">
  > names>
>

<let group <array "Jackie" "Daniel" "Jean" "Paul">>

<io.echo <greet_everyones_except group "Jean">>
```

It features a lib/import system and clojure.

The namespace/variable system is currently broken.

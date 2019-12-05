<import "io">

<func arr.join <chr>
  <func <arr>
    <sys "Array" "prototype" "join" <chr arr>>
  >
>

<func arr.pipe <>
  <let functions __arguments__>

  <func <data>
    <<arr.reduce
      <func <acc arr> <arr acc>>
      data
    > functions>
  >
>

<func arr.concat <a b>
  <sys "Array" "prototype" "concat" <a b>>
>

<func arr.filter <test_func>
  <func <arr>
    <sys "Array" "prototype" "filter" <arr test_func>>
  >
>

<func arr.map <map_func>
  <func <arr>
    <sys "Array" "prototype" "map" <arr map_func>>
  >
>

<func arr.reduce <funct init>
  <func <arr>
    <sys "Array" "prototype" "reduce" <arr funct init>>
  >
>

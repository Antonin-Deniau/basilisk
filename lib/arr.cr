<func arr.join <chr>
  <func <arr>
    <reduce
      arr
      <func <acc arr> <+ acc chr arr>>
      ""
    >
  >
>

<func arr.pipe <>
  <let functions __arguments__>
  <func <data>
    <reduce
      functions
      <func <acc arr> <arr acc>>
      data
    >
  >
>

<func arr.concat <a b>
  <sys "Array" "prototype" "concat" <a b>>
>

<func arr.filter <test_func>
  <func <arr>
    <arr.reduce
      arr
      <func <acc arr>
        <if <test_func arr>
          <arr.concat <acc <array arr>>>
          acc
        >
      >
      <array>
    >
  >
>

<func arr.map <map_func>
  <func <arr>
    <reduce arr
      <func <acc arr>
        <sys "Array" "prototype" "concat"
          <acc <array <map_func arr>>>
        >
      >
      <array>
    >
  >
>

<func arr.reduce <data func init>
  <reduce data func init>
>

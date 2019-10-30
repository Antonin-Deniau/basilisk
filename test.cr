<import "io">

<# This is a function to greet someone>
<func greeting <name>
	<+ "Hello " name " !">
>

<func greet_everyones_except <names except> 
	<pipe names
		<filter <func <name> <!= name except>>>
		<map greeting>
		<join "\n">
	>
>

<let group <array "Jackie" "Daniel" "Jean" "Paul">>

<io.echo <greeting "Jean">>
<# <io.echo <greet_everyones_except group "Jean"\>>

<import "utils.json">
<import "utils.io">

<# This is a comment>
<func greeting <name>
	<+ "Hello " name " !">
>

<? <== 1 2>
	<io.echo <greeting "Antonin">>

	<io.echo greeting>
>

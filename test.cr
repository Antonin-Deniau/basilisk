<import "./utils/json.cr">
<import "./utils/io.cr">

<# This is a comment>

<func greeting <name>
	<+ "Hello " name " !">
>

<echo <to_json PATH>>
<echo <greeting "lol">>
<echo <to_json greeting>>

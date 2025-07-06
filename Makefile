test1:
	(cd ./src && ../runtest.py --debug=test ../tests/step1_read_print.mal ./parser.py)

test2:
	(cd ./src && ../runtest.py --debug=test ../tests/step2_eval.mal ./basilisk)

test3:
	(cd ./src && ../runtest.py --debug=test ../tests/step3_env.mal ./basilisk)

test4:
	(cd ./src && ../runtest.py --debug=test ../tests/step4_if_fn_do.mal ./basilisk)

test5:
	(cd ./src && ../runtest.py --debug=test ../tests/step5_tco.mal ./basilisk)

test6:
	(cd ./src && ../runtest.py --debug=test ../tests/step6_file.mal ./basilisk)

test7:
	(cd ./src && ../runtest.py --debug=test ../tests/step7_quote.mal ./basilisk)

test8:
	(cd ./src && ../runtest.py --debug=test ../tests/step8_macros.mal ./basilisk)

test9:
	(cd ./src && ../runtest.py --debug=test ../tests/step9_try.mal ./basilisk)

testA:
	(cd ./src && ../runtest.py --debug=test ../tests/stepA_mal.mal ./basilisk)

testA1:
	(cd ./src && ../runtest.py --debug=test ../tests/step1_read_print.mal ./basilisk ../tests/step1_read_print.mal)

testA2:
	(cd ./src && ../runtest.py --debug=test ../tests/step2_eval.mal ./basilisk ../tests/step2_eval.mal)

testA3:
	(cd ./src && ../runtest.py --debug=test ../tests/step3_env.mal ./basilisk ../tests/step3_env.mal)

testA4:
	(cd ./src && ../runtest.py --debug=test ../tests/step4_if_fn_do.mal ./basilisk ../tests/step4_if_fn_do.mal)

testA6:
	(cd ./src && ../runtest.py --debug=test ../tests/step6_file.mal ./basilisk ../tests/step6_file.mal)

testA7:
	(cd ./src && ../runtest.py --debug=test ../tests/step7_quote.mal ./basilisk ../tests/step7_quote.mal)

testA8:
	(cd ./src && ../runtest.py --debug=test ../tests/step8_macros.mal ./basilisk ../tests/step8_macros.mal)

testA9:
	(cd ./src && ../runtest.py --debug=test ../tests/step9_try.mal ./basilisk ../tests/step9_try.mal)


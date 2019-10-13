
## TODO:

  * Parameters are referenced as `parameter.value`, which is almost always a type error even though it generates the "correct" stack. Remember what type of parameter we have and attempt to cast it appropriately.

  * Conditions almost always lead to type errors. Add a "--as-any-conditions" option to allow generation of code that'll produce less typing errors for prototyping.

  * Only integration tests exist today, making testing edge cases very difficult. Add unit tests.

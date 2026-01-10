#!/bin/bash
git config user.name "jerryt92"
git config user.mail "jerrytian92@outlook.com"
git config user.name
git reset 4a062fcb38c741ae921e4ce4f9dc492c050466e5 --soft
git push -f
git add .
git commit -m 'update models'
git push
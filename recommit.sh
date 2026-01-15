#!/bin/bash
git config user.name "jerryt92"
git config user.mail "jerrytian92@outlook.com"
git config user.name
git reset 912b2401d33597b2dbcd60eb002bb8a5191e9182 --soft
git push -f
git add .
git commit -m 'update models'
git push
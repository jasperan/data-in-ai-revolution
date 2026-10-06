//go:build windows

package workspace

import "io/fs"

func ownedByCurrentUser(fs.FileInfo) bool { return true }
